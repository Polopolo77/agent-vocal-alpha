"""
server.py — Backend aiohttp pour le Concierge IA Argo Éditions (multi-produits).

Endpoints :
  GET  /api/products                → catalog des produits prêts (liste pour sélecteur UI)
  POST /api/token                    → clé Gemini Live (non-sensible, destinée au client)
  GET  /api/prompt?product=<id>      → SYSTEM_INSTRUCTION complet pour Gemini Live
  POST /api/strategist               → coach (analyse conversation) — requiert product_id
  POST /api/ui-director              → décisions visuelles (card + dossier) — requiert product_id
  POST /api/briefing                 → tool calling : coach cache + recherche BM25 lettre de vente
  POST /api/save-conversation        → sauvegarde SQLite du transcript
  GET  /api/conversations            → admin : 100 dernières conversations
  GET  /{static}                     → assets frontend

Au démarrage :
  - SQLite initialisé
  - Registre des produits chargé (products/catalog.json + chunks BM25)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from aiohttp import web
from dotenv import load_dotenv
from google import genai

from products_loader import init as init_products, REGISTRY
from prompts import (
    DEFAULT_AGENT_NAME,
    build_briefing_from_cache,
    build_coach_prompt,
    build_full_agent_prompt,
    build_ui_director_prompt,
)

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("argo")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FRONTEND_DIR = Path(__file__).parent / "frontend"
DB_PATH = Path(__file__).parent / "conversations.db"

# Modèle Gemini Live pour l'agent vocal (côté client)
LIVE_MODEL = "gemini-3.1-flash-live-preview"

# Modèle rapide pour coach et UI director
COACH_MODEL = "gemini-2.5-flash-lite"

# Cache global : { session_id: { "directive": JSON, "product_id": str, "timestamp": str, "turn": int } }
coach_cache: dict[str, dict] = {}

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


# =============================================================================
# Database
# =============================================================================

def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL,
            duration_seconds INTEGER,
            message_count INTEGER,
            product_id TEXT,
            transcript TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT
        )
    """)
    # Migration : ajouter product_id si absent
    cursor.execute("PRAGMA table_info(conversations)")
    cols = {row[1] for row in cursor.fetchall()}
    if "product_id" not in cols:
        cursor.execute("ALTER TABLE conversations ADD COLUMN product_id TEXT")
    conn.commit()
    conn.close()
    log.info("Database ready at %s", DB_PATH)


# =============================================================================
# Helpers
# =============================================================================

def _format_history(history: list[dict]) -> str:
    return "\n".join(
        f"[{m.get('role', '?').upper()}] {m.get('text', '')}"
        for m in history
    )


def _require_product(data: dict) -> tuple[str | None, web.Response | None]:
    """Return (product_id, None) or (None, error_response)."""
    pid = data.get("product_id")
    if not pid:
        return None, web.json_response(
            {"error": "missing product_id"},
            status=400,
        )
    if pid not in REGISTRY.products:
        return None, web.json_response(
            {"error": f"unknown product_id: {pid}", "available": REGISTRY.list_ready()},
            status=404,
        )
    return pid, None


# =============================================================================
# Endpoints
# =============================================================================

async def handle_token(request: web.Request) -> web.Response:
    """Provide API key for the frontend to connect to Gemini Live."""
    if not GEMINI_API_KEY:
        return web.json_response({"error": "GEMINI_API_KEY not configured"}, status=500)
    return web.json_response({"token": GEMINI_API_KEY, "model": LIVE_MODEL})


async def handle_list_products(request: web.Request) -> web.Response:
    """
    List all ready products with the data the frontend needs to render.

    - Minimal metadata (id, name, vertical, expert, offers, lead_magnet).
    - `guarantees` list from config.
    - `images_by_card` dict mapping UI Director's `card_a_afficher` values
      to image metadata (url + description + role), so the page can
      render smart cards without a second fetch.
    """
    products = []
    for pid, p in REGISTRY.products.items():
        # Build usage_card → image mapping
        images_by_card: dict[str, dict] = {}
        for img in (p.images.get("images", []) if isinstance(p.images, dict) else []):
            key = img.get("usage_card")
            if not key:
                continue
            if key not in images_by_card:
                images_by_card[key] = {
                    "url": img.get("url"),
                    "description": img.get("description", ""),
                    "role": img.get("role", ""),
                }

        products.append({
            "product_id": pid,
            "slug": p.slug,
            "name": p.config.get("product_name", p.product_name),
            "vertical": p.vertical,
            "expert": p.config.get("lead_expert", {}).get("name"),
            "offers": p.config.get("offers", {}),
            "lead_magnet": (
                p.config.get("lead_magnet", {}).get("title")
                if isinstance(p.config.get("lead_magnet"), dict)
                else p.config.get("lead_magnet")
            ),
            "guarantees": p.config.get("guarantees", []),
            "images_by_card": images_by_card,
        })
    return web.json_response({
        "catalog_version": REGISTRY.catalog.get("version"),
        "products": products,
    })


async def handle_prompt(request: web.Request) -> web.Response:
    """Return the SYSTEM_INSTRUCTION for a given product."""
    product_id = request.query.get("product")
    agent_name = request.query.get("agent_name", DEFAULT_AGENT_NAME)

    if not product_id:
        return web.json_response(
            {"error": "missing ?product=<id> query param", "available": REGISTRY.list_ready()},
            status=400,
        )
    p = REGISTRY.get(product_id)
    if not p:
        return web.json_response(
            {"error": f"unknown product: {product_id}", "available": REGISTRY.list_ready()},
            status=404,
        )

    prompt = build_full_agent_prompt(p, agent_name=agent_name)
    return web.json_response({
        "prompt": prompt,
        "product_id": product_id,
        "product_name": p.config.get("product_name", p.product_name),
        "expert": p.config.get("lead_expert", {}).get("name"),
        "agent_name": agent_name,
        "voice": "Puck",
        "live_model": LIVE_MODEL,
    })


async def handle_strategist(request: web.Request) -> web.Response:
    """Coach: analyze the conversation and return tactical directives as JSON."""
    if not client:
        return web.json_response({"error": "GEMINI_API_KEY not configured"}, status=500)
    try:
        data = await request.json()
        pid, err = _require_product(data)
        if err:
            return err

        history = data.get("history", [])
        if not history:
            return web.json_response({"error": "empty history"}, status=400)

        turn_number = data.get("turn_number", 0)
        mode = data.get("mode", "mid_call")
        agent_name = data.get("agent_name", DEFAULT_AGENT_NAME)
        session_id = data.get("session_id", "default")

        p = REGISTRY.get(pid)
        history_text = _format_history(history)
        base = build_coach_prompt(p, agent_name=agent_name)

        if mode == "post_call":
            suffix = (
                "\n\n═══════════════════════════════════════════════\n"
                "MODE POST-CALL\n"
                "═══════════════════════════════════════════════\n\n"
                "La conversation est TERMINÉE. Tu génères le rapport final. Remplis tous les champs "
                "avec l'état final, et dans directive_prochain_tour.action_principale mets un résumé "
                "des 3 points clés à faire remonter à l'équipe Argo."
            )
        else:
            suffix = (
                f"\n\n═══════════════════════════════════════════════\n"
                f"TOUR ACTUEL : {turn_number}\n"
                "═══════════════════════════════════════════════\n\n"
                f"{agent_name} doit maintenant répondre au dernier message du prospect. "
                f"Donne-lui la directive tactique la plus utile pour ce tour précis."
            )

        full_prompt = base + history_text + suffix

        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=COACH_MODEL,
                contents=full_prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.3,
                    "max_output_tokens": 8192,
                    "thinking_config": {"thinking_budget": 0},
                },
            )
        )

        try:
            coach_output = json.loads(response.text)
        except Exception as parse_err:
            log.warning("Coach JSON parse error: %s", parse_err)
            log.warning("Raw output: %s", response.text[:500])
            return web.json_response(
                {"error": "invalid_json_from_coach", "raw": response.text[:500]},
                status=500,
            )

        # Logs
        log.info(
            "COACH [%s/%s] turn=%s archetype=%s chaleur=%s tier=%s",
            pid,
            mode,
            turn_number,
            coach_output.get("archetype_detecte"),
            coach_output.get("etat_emotionnel", {}).get("chaleur"),
            coach_output.get("produit", {}).get("tier_recommande"),
        )

        coach_cache[session_id] = {
            "directive": coach_output,
            "product_id": pid,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "turn": turn_number,
        }

        return web.json_response(coach_output)
    except Exception as e:
        log.exception("Coach error")
        return web.json_response({"error": str(e)}, status=500)


async def handle_ui_director(request: web.Request) -> web.Response:
    """Fast UI agent: decides what card to show + what to write in the dossier."""
    if not client:
        return web.json_response({"card_a_afficher": None, "dossier": {}})
    try:
        data = await request.json()
        pid, err = _require_product(data)
        if err:
            # Pas critique : on renvoie juste une réponse vide plutôt qu'une erreur
            return web.json_response({"card_a_afficher": None, "dossier": {}})

        history = data.get("history", [])
        previous_dossier = data.get("previous_dossier", {})
        agent_name = data.get("agent_name", DEFAULT_AGENT_NAME)

        if not history:
            return web.json_response({"card_a_afficher": None, "dossier": {}})

        p = REGISTRY.get(pid)
        recent = history[-6:] if len(history) > 6 else history
        history_text = _format_history(recent)

        if previous_dossier:
            history_text += (
                "\n\n═══════════════════\nDOSSIER PRÉCÉDENT (à enrichir/corriger, pas effacer)\n"
                "═══════════════════\n"
                + json.dumps(previous_dossier, ensure_ascii=False)
            )

        full_prompt = build_ui_director_prompt(p, agent_name=agent_name) + history_text

        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=COACH_MODEL,
                contents=full_prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.2,
                    "max_output_tokens": 1024,
                    "thinking_config": {"thinking_budget": 0},
                },
            )
        )

        try:
            result = json.loads(response.text)
        except Exception:
            return web.json_response({"card_a_afficher": None, "dossier": {}})

        return web.json_response(result)
    except Exception as e:
        log.exception("UI Director error")
        return web.json_response({"card_a_afficher": None, "dossier": {}})


async def handle_briefing(request: web.Request) -> web.Response:
    """
    Tool calling endpoint: returns the coach directive + BM25 hits for the query.

    Input JSON: {
      "session_id": str,
      "query": str,              # preferred (new)
      "user_message": str,       # legacy fallback
      "product_id": str | null,  # optional override; else uses coach cache's product
    }
    """
    try:
        data = await request.json()
        session_id = data.get("session_id", "default")
        query = (data.get("query") or data.get("user_message") or "").strip()
        product_id_override = data.get("product_id")

        cached = coach_cache.get(session_id)
        product_id = product_id_override or (cached.get("product_id") if cached else None)
        product = REGISTRY.get(product_id) if product_id else None

        # BM25 search
        bm25_hits = []
        if product and query:
            bm25_hits = REGISTRY.search(product_id, query, k=4)

        briefing = build_briefing_from_cache(cached, bm25_hits, query, product=product)
        return web.json_response(briefing)
    except Exception as e:
        log.exception("Briefing error")
        return web.json_response({"error": str(e)}, status=500)


async def handle_save_conversation(request: web.Request) -> web.Response:
    """Save a conversation transcript to SQLite."""
    try:
        data = await request.json()
        started_at = data.get("started_at", "")
        ended_at = data.get("ended_at", datetime.now(timezone.utc).isoformat())
        messages = data.get("messages", [])
        product_id = data.get("product_id")

        if not messages:
            return web.json_response({"status": "skipped", "reason": "empty"}, status=200)

        try:
            start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
            duration = int((end_dt - start_dt).total_seconds())
        except Exception:
            duration = 0

        transcript_text = "\n".join(
            f"[{m.get('role', '?').upper()}] {m.get('text', '')}" for m in messages
        )
        transcript_json = json.dumps(messages, ensure_ascii=False)

        ip = request.headers.get("X-Forwarded-For", request.remote or "")
        user_agent = request.headers.get("User-Agent", "")[:500]

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO conversations
            (started_at, ended_at, duration_seconds, message_count, product_id, transcript, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            started_at, ended_at, duration, len(messages),
            product_id, transcript_json, ip, user_agent,
        ))
        conversation_id = cursor.lastrowid
        conn.commit()
        conn.close()

        log.info(
            "CONV #%s saved | product=%s duration=%ss messages=%d",
            conversation_id, product_id, duration, len(messages),
        )
        # Transcript aussi en log pour debug
        print(f"\n========== CONVERSATION #{conversation_id} (product={product_id}) ==========")
        print(transcript_text)
        print("=" * 60)

        return web.json_response({"status": "saved", "id": conversation_id})
    except Exception as e:
        log.exception("Save conversation error")
        return web.json_response({"error": str(e)}, status=500)


async def handle_list_conversations(request: web.Request) -> web.Response:
    """List latest 100 conversations (simple admin view)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, started_at, duration_seconds, message_count, product_id, transcript
        FROM conversations
        ORDER BY id DESC
        LIMIT 100
    """)
    rows = cursor.fetchall()
    conn.close()

    conversations = []
    for row in rows:
        try:
            messages = json.loads(row["transcript"])
        except Exception:
            messages = []
        conversations.append({
            "id": row["id"],
            "started_at": row["started_at"],
            "duration_seconds": row["duration_seconds"],
            "message_count": row["message_count"],
            "product_id": row["product_id"],
            "messages": messages,
        })
    return web.json_response({"conversations": conversations})


async def handle_static(request: web.Request) -> web.Response:
    """Serve static frontend files."""
    path = request.match_info.get("path", "index.html") or "index.html"

    file_path = (FRONTEND_DIR / path).resolve()
    if not str(file_path).startswith(str(FRONTEND_DIR.resolve())):
        return web.Response(status=403)
    if file_path.is_dir():
        file_path = file_path / "index.html"
    if not file_path.is_file():
        return web.Response(status=404, text="Not found")

    content_types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
    }
    ext = file_path.suffix.lower()
    content_type = content_types.get(ext, "application/octet-stream")
    return web.FileResponse(file_path, headers={"Content-Type": content_type})


# =============================================================================
# App setup
# =============================================================================

app = web.Application()
app.router.add_get("/api/products", handle_list_products)
app.router.add_post("/api/token", handle_token)
app.router.add_get("/api/prompt", handle_prompt)
app.router.add_post("/api/strategist", handle_strategist)
app.router.add_post("/api/ui-director", handle_ui_director)
app.router.add_post("/api/briefing", handle_briefing)
app.router.add_post("/api/save-conversation", handle_save_conversation)
app.router.add_get("/api/conversations", handle_list_conversations)
app.router.add_get("/", handle_static)
app.router.add_get("/{path:.*}", handle_static)


# CORS — le widget peut être embarqué sur un domaine externe
@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        return web.Response(headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


app.middlewares.append(cors_middleware)
app.router.add_route("OPTIONS", "/{path:.*}", lambda r: web.Response())


if __name__ == "__main__":
    init_db()
    reg = init_products()
    log.info(
        "Loaded %d products: %s",
        len(reg.products),
        ", ".join(reg.list_ready()),
    )

    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY not set. Create a .env file with your key.")
        log.warning("Get one at: https://aistudio.google.com/apikey")

    port = int(os.getenv("PORT", "8000"))
    log.info("Server starting on port %d", port)
    web.run_app(app, host="0.0.0.0", port=port)
