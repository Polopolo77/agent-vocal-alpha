"""
server.py — Backend STANDALONE pour les widgets vocaux/chat autonomes :
  - Assistant Argo (landing "La Monnaie de l'IA")
  - Assistant Héritage (landing "Trinity Sphères")

Séparé du projet Argos Concierge (argo-editions) pour éviter tout conflit.

SÉCURITÉ (proxy) : la clé Gemini et les prompts système restent CÔTÉ SERVEUR.
  - /api/live?agent=<x>  : proxy WebSocket navigateur <-> Gemini Live.
                            Le client envoie son setup SANS clé. Le serveur
                            injecte le prompt de base + la clé, et préfixe le
                            prompt au contexte de page (sections) envoyé par le client.
  - /api/text?agent=<x>  : proxy HTTP pour le chat texte (generateContent).
                            Même logique : prompt de base injecté côté serveur.
  - /api/save-conversation : sauvegarde du transcript dans Supabase.
  - /api/health           : ping.
  - /<fichier>            : sert les widgets JS + le mascot.

Variables d'environnement (Railway) :
  GEMINI_API_KEY   (obligatoire)
  SUPABASE_URL     (def: projet nenpyfzs...)
  SUPABASE_KEY     (def: clé anon)
  PORT             (fourni par Railway)
"""

from __future__ import annotations

import json
import logging
import os
import ssl
from datetime import datetime, timezone
from pathlib import Path

import aiohttp
from aiohttp import web

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("standalone")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://nenpyfzsxrbjztsjbbnf.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbnB5ZnpzeHJianp0c2piYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTM5NjQsImV4cCI6MjA5MjQyOTk2NH0.c1OQitjA9dS2tFALVxNWy1FeBSKxdpv61JTrlQW5cHM",
)

LIVE_MODEL = "gemini-3.1-flash-live-preview"
TEXT_MODEL = "gemini-2.5-flash"

BASE_DIR = Path(__file__).parent
FRONTEND_DIR = (BASE_DIR / "frontend").resolve()
PROMPTS_DIR = (BASE_DIR / "prompts_files").resolve()

MAX_PAYLOAD_BYTES = 512 * 1024
MAX_MESSAGE_TEXT_LEN = 4000
MAX_HISTORY_MESSAGES = 400

# SSL upstream via certifi (vérif fiable sur conteneur minimaliste)
try:
    import certifi
    _UPSTREAM_SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _UPSTREAM_SSL = None

# Cache mémoire des prompts (chargés à la demande)
_PROMPT_CACHE: dict[str, str] = {}


def _load_prompt(agent: str) -> str:
    """Charge prompts_files/<agent>_prompt.txt (sanitize le nom). Cache mémoire.
    agent='raw'/'none' => aucun prompt injecté (ex: analyse de page autonome)."""
    if (agent or "").lower() in ("raw", "none"):
        return ""
    safe = "".join(c for c in (agent or "") if c.isalnum() or c in "-_").replace("-", "_")
    if not safe:
        safe = "assistant_argo"
    if safe in _PROMPT_CACHE:
        return _PROMPT_CACHE[safe]
    path = PROMPTS_DIR / f"{safe}_prompt.txt"
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        log.warning("Prompt introuvable pour agent=%s (%s)", agent, path.name)
        text = ""
    _PROMPT_CACHE[safe] = text
    return text


# =============================================================================
# Helpers
# =============================================================================

def _sanitize_history(history) -> list[dict]:
    """Nettoie une liste de messages [{role, text}] avant stockage."""
    out: list[dict] = []
    if not isinstance(history, list):
        return out
    for m in history[:MAX_HISTORY_MESSAGES]:
        if not isinstance(m, dict):
            continue
        role = str(m.get("role", "?"))[:32]
        text = str(m.get("text", ""))[:MAX_MESSAGE_TEXT_LEN]
        out.append({"role": role, "text": text})
    return out


def _client_ip(request: web.Request) -> str:
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote or ""


def _merge_system_instruction(setup_or_body: dict, base_prompt: str) -> None:
    """Préfixe le prompt de base (secret) au systemInstruction envoyé par le
    client (qui ne contient QUE le contexte de page : sections, brief).
    Modifie le dict en place."""
    existing = ""
    si = setup_or_body.get("systemInstruction")
    if isinstance(si, dict):
        for p in si.get("parts", []) or []:
            if isinstance(p, dict) and isinstance(p.get("text"), str):
                existing += p["text"]
    full = base_prompt
    if existing.strip():
        full = base_prompt + "\n\n" + existing
    setup_or_body["systemInstruction"] = {"parts": [{"text": full}]}


# =============================================================================
# /api/live — proxy WebSocket Gemini Live
# =============================================================================

def _inject_live_setup(payload: str, base_prompt: str) -> str:
    try:
        obj = json.loads(payload)
    except Exception:
        return payload
    setup = obj.get("setup") if isinstance(obj, dict) else None
    if isinstance(setup, dict):
        _merge_system_instruction(setup, base_prompt)
        setup["model"] = "models/" + LIVE_MODEL
        return json.dumps(obj)
    return payload


async def handle_live(request: web.Request) -> web.StreamResponse:
    if not GEMINI_API_KEY:
        return web.json_response({"error": "GEMINI_API_KEY not configured"}, status=500)

    agent = request.query.get("agent", "assistant-argo")
    base_prompt = _load_prompt(agent)

    ws_client = web.WebSocketResponse(max_msg_size=16 * 1024 * 1024, heartbeat=30)
    await ws_client.prepare(request)

    M = aiohttp.WSMsgType
    gem_url = (
        "wss://generativelanguage.googleapis.com/ws/"
        "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
        f"?key={GEMINI_API_KEY}"
    )
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.ws_connect(
                gem_url, max_msg_size=16 * 1024 * 1024, heartbeat=30,
                ssl=_UPSTREAM_SSL,
            ) as ws_gem:

                async def client_to_gemini():
                    first = True
                    async for msg in ws_client:
                        if msg.type == M.TEXT:
                            data = msg.data
                            if first:
                                first = False
                                data = _inject_live_setup(data, base_prompt)
                            await ws_gem.send_str(data)
                        elif msg.type == M.BINARY:
                            await ws_gem.send_bytes(msg.data)
                        else:
                            break
                    if not ws_gem.closed:
                        await ws_gem.close()

                async def gemini_to_client():
                    async for msg in ws_gem:
                        if msg.type == M.TEXT:
                            await ws_client.send_str(msg.data)
                        elif msg.type == M.BINARY:
                            await ws_client.send_bytes(msg.data)
                        else:
                            break
                    if not ws_client.closed:
                        await ws_client.close()

                import asyncio
                await asyncio.gather(
                    client_to_gemini(), gemini_to_client(), return_exceptions=True
                )
    except Exception:
        log.exception("Live proxy error")
    finally:
        if not ws_client.closed:
            await ws_client.close()
    return ws_client


# =============================================================================
# /api/text — proxy HTTP generateContent (chat texte)
# =============================================================================

async def handle_text(request: web.Request) -> web.Response:
    if not GEMINI_API_KEY:
        return web.json_response({"error": "GEMINI_API_KEY not configured"}, status=500)

    agent = request.query.get("agent", "assistant-argo")
    base_prompt = _load_prompt(agent)

    raw = await request.read()
    if len(raw) > MAX_PAYLOAD_BYTES:
        return web.json_response({"error": "payload_too_large"}, status=413)
    try:
        body = json.loads(raw.decode("utf-8", errors="replace"))
    except Exception:
        return web.json_response({"error": "invalid_json"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "invalid_body"}, status=400)

    # Injecte le prompt de base (secret) + préfixe au contexte de page du client.
    _merge_system_instruction(body, base_prompt)

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{TEXT_MODEL}:generateContent?key={GEMINI_API_KEY}"
    )
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                url, json=body, ssl=_UPSTREAM_SSL,
                timeout=aiohttp.ClientTimeout(total=60),
            ) as resp:
                data = await resp.json()
                return web.json_response(data, status=resp.status)
    except Exception as e:
        log.exception("Text proxy error")
        return web.json_response({"error": str(e)}, status=502)


# =============================================================================
# /api/save-conversation — sauvegarde Supabase
# =============================================================================

async def handle_save_conversation(request: web.Request) -> web.Response:
    try:
        raw = await request.read()
        if len(raw) > MAX_PAYLOAD_BYTES:
            return web.json_response({"error": "payload_too_large"}, status=413)
        try:
            data = json.loads(raw.decode("utf-8", errors="replace"))
        except Exception:
            return web.json_response({"error": "invalid_json"}, status=400)

        started_at = str(data.get("started_at", ""))[:64]
        ended_at = str(data.get("ended_at", datetime.now(timezone.utc).isoformat()))[:64]
        messages = _sanitize_history(data.get("messages", []))
        raw_pid = data.get("product_id")
        product_id = str(raw_pid)[:64] if raw_pid else None

        if not messages:
            return web.json_response({"status": "skipped", "reason": "empty"}, status=200)

        try:
            start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
            duration = int((end_dt - start_dt).total_seconds())
        except Exception:
            duration = 0

        ip = _client_ip(request)[:45]
        user_agent = request.headers.get("User-Agent", "")[:500]

        sb_payload = {
            "started_at": started_at,
            "ended_at": ended_at,
            "duration_seconds": duration,
            "message_count": len(messages),
            "product_id": product_id,
            "transcript": messages,
            "ip_address": ip,
            "user_agent": user_agent,
        }
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                f"{SUPABASE_URL}/rest/v1/voice_conversations",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
                json=sb_payload,
                ssl=_UPSTREAM_SSL,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                cid = None
                if resp.status in (200, 201):
                    rows = await resp.json()
                    if rows:
                        cid = rows[0].get("id")
                else:
                    txt = await resp.text()
                    log.warning("Supabase save failed %s: %s", resp.status, txt[:200])
        log.info("CONV #%s saved | product=%s msgs=%d", cid, product_id, len(messages))
        return web.json_response({"status": "saved", "id": cid})
    except Exception as e:
        log.exception("Save conversation error")
        return web.json_response({"error": str(e)}, status=500)


async def handle_health(request: web.Request) -> web.Response:
    # Liste dynamique : un agent = un fichier prompts_files/<agent>_prompt.txt
    try:
        agents = sorted(
            p.name.removesuffix("_prompt.txt").replace("_", "-")
            for p in PROMPTS_DIR.glob("*_prompt.txt")
        )
    except Exception:
        agents = []
    return web.json_response({
        "status": "ok",
        "service": "standalone-agents",
        "agents": agents,
        "gemini_key_set": bool(GEMINI_API_KEY),
    })


# =============================================================================
# Static — sert les widgets JS + mascot
# =============================================================================

_CONTENT_TYPES = {
    ".js": "application/javascript; charset=utf-8",
    ".gif": "image/gif",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
}


async def handle_static(request: web.Request) -> web.Response:
    raw = request.match_info.get("path", "") or ""
    if "\x00" in raw or raw.startswith("/") or ".." in raw:
        return web.Response(status=400)
    candidate = (FRONTEND_DIR / raw)
    try:
        file_path = candidate.resolve(strict=False)
    except Exception:
        return web.Response(status=400)
    try:
        file_path.relative_to(FRONTEND_DIR)
    except ValueError:
        return web.Response(status=403)
    if not file_path.is_file():
        return web.Response(status=404, text="Not found")
    ct = _CONTENT_TYPES.get(file_path.suffix.lower(), "application/octet-stream")
    return web.Response(body=file_path.read_bytes(), content_type=ct.split(";")[0],
                        charset="utf-8" if "charset" in ct else None)


# =============================================================================
# App + CORS
# =============================================================================

@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        resp = web.Response(status=204)
    else:
        try:
            resp = await handler(request)
        except web.HTTPException as e:
            resp = e
    origin = request.headers.get("Origin", "*")
    resp.headers["Access-Control-Allow-Origin"] = origin
    resp.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Vary"] = "Origin"
    return resp


app = web.Application(client_max_size=MAX_PAYLOAD_BYTES, middlewares=[cors_middleware])
app.router.add_get("/api/health", handle_health)
app.router.add_get("/api/live", handle_live)
app.router.add_post("/api/text", handle_text)
app.router.add_post("/api/save-conversation", handle_save_conversation)
app.router.add_get("/{path:.*}", handle_static)


if __name__ == "__main__":
    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY non défini — le proxy renverra 500.")
    # Préchauffe les prompts
    for a in ("assistant-argo", "assistant-heritage"):
        n = len(_load_prompt(a))
        log.info("Prompt %s: %d chars", a, n)
    port = int(os.getenv("PORT", "8000"))
    log.info("Standalone agents server starting on port %d", port)
    web.run_app(app, host="0.0.0.0", port=port)
