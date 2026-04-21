"""
server.py — Backend aiohttp pour le Concierge IA Argo Éditions (multi-produits).

Endpoints :
  GET  /api/products                → catalog des produits prêts (liste pour sélecteur UI)
  POST /api/token                    → clé Gemini Live (non-sensible, destinée au client)
  POST /api/session                  → session_id signé côté serveur (anti-spoofing coach_cache)
  GET  /api/prompt?product=<id>      → SYSTEM_INSTRUCTION complet pour Gemini Live
  POST /api/strategist               → coach (analyse conversation) — requiert product_id
  POST /api/ui-director              → décisions visuelles (card + dossier) — requiert product_id
  POST /api/briefing                 → tool calling : coach cache + recherche BM25 lettre de vente
  POST /api/save-conversation        → sauvegarde SQLite du transcript
  GET  /api/conversations            → admin : 100 dernières conversations
  GET  /{static}                     → assets frontend

Au démarrage :
  - SQLite initialisé (WAL mode pour concurrence sendBeacon + post-call)
  - Registre des produits chargé (products/catalog.json + chunks BM25)
  - SYSTEM_INSTRUCTION compilé 1 fois et mis en cache (CACHED_PROMPT)
  - Nettoyage périodique coach_cache toutes les 5min
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
import sqlite3
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from aiohttp import web
from dotenv import load_dotenv
from google import genai

from products_loader import init as init_products, REGISTRY
from prompts import (
    DEFAULT_AGENT_NAME,
    build_briefing_from_cache,
    build_coach_prompt,
    build_full_agent_prompt,
    build_ui_dossier_prompt,
    build_ui_cards_prompt,
)

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("argo")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FRONTEND_DIR = (Path(__file__).parent / "frontend").resolve()
DB_PATH = Path(__file__).parent / "conversations.db"

# Modèle Gemini Live pour l'agent vocal (côté client)
LIVE_MODEL = "gemini-3.1-flash-live-preview"

# Modèle rapide pour coach
COACH_MODEL = "gemini-2.5-flash-lite"
# Modèle plus costaud pour le dossier : flash-lite hallucinait (ex: inventait
# "salarié" et "peur de perdre" sans aucune citation du prospect).
DOSSIER_MODEL = "gemini-2.5-flash"
# Modèle costaud pour l'agent cartes : il doit raisonner sur contexte
# riche (dossier + coach + historique cartes) et éviter les répétitions.
CARDS_MODEL = "gemini-3.0-flash"

# =============================================================================
# SÉCURITÉ — rate limiting + security headers (CORS permissif)
# =============================================================================

# Rate limiting : fenêtre glissante par IP + endpoint
# Les endpoints coûteux (Gemini) sont bridés plus fort.
RATE_LIMITS: dict[str, tuple[int, int]] = {
    # path_prefix: (max_requests, window_seconds)
    "/api/token":      (20, 3600),   # 20 tokens/h/IP
    "/api/strategist": (200, 3600),  # 200 coach calls/h/IP
    "/api/ui-dossier": (300, 3600),
    "/api/ui-cards":   (300, 3600),
    "/api/ui-director":(300, 3600),
    "/api/briefing":   (300, 3600),
    "/api/save-conversation": (60, 3600),
}
# Stockage en mémoire : {(ip, path): deque[timestamps]}
_rate_buckets: dict[tuple[str, str], deque] = {}

# Limites anti-abus sur les payloads
MAX_HISTORY_MESSAGES = 200
MAX_MESSAGE_TEXT_LEN = 4000
MAX_PAYLOAD_BYTES = 512 * 1024  # 512 KB — un transcript très long tient dedans

# Sessions émises côté serveur (anti-spoofing coach_cache)
_valid_sessions: dict[str, float] = {}  # sid → created_at (float ts)
SESSION_TTL_SECONDS = 4 * 3600  # 4h

# Cache global : { session_id: { "directive": JSON, "product_id": str, "timestamp": str, "turn": int } }
# TTL 30min pour éviter memory leak
coach_cache: dict[str, dict] = {}
COACH_CACHE_TTL_SECONDS = 1800

# Prompt système compilé UNE FOIS (optimisation : évite de reconstruire à chaque /api/prompt)
CACHED_PROMPT: str = ""
CACHED_PROMPT_AGENT = DEFAULT_AGENT_NAME


def _cleanup_coach_cache() -> None:
    """Retire les entrées du cache plus vieilles que TTL."""
    if not coach_cache:
        return
    now = datetime.now(timezone.utc)
    stale = []
    for sid, entry in coach_cache.items():
        try:
            ts = datetime.fromisoformat(entry.get("timestamp", "").replace("Z", "+00:00"))
            if (now - ts).total_seconds() > COACH_CACHE_TTL_SECONDS:
                stale.append(sid)
        except Exception:
            stale.append(sid)
    for sid in stale:
        coach_cache.pop(sid, None)
    if stale:
        log.info("Cleaned %d stale coach cache entries", len(stale))


def _cleanup_sessions() -> None:
    """Purge les sessions expirées + historique cartes des sessions disparues."""
    now = time.time()
    stale = [sid for sid, ts in _valid_sessions.items() if now - ts > SESSION_TTL_SECONDS]
    for sid in stale:
        _valid_sessions.pop(sid, None)
    # Purge cards session history pour sessions plus dans _valid_sessions
    valid_ids = set(_valid_sessions.keys())
    orphans = [sid for sid in _cards_session_history.keys() if sid not in valid_ids and sid != "default"]
    for sid in orphans:
        _cards_session_history.pop(sid, None)


def _cleanup_rate_buckets() -> None:
    """Retire les buckets vides (timestamps tous expirés)."""
    now = time.time()
    empty_keys = []
    for k, dq in _rate_buckets.items():
        # Purge in-place les timestamps obsolètes
        window = RATE_LIMITS.get(k[1], (0, 3600))[1]
        cutoff = now - window
        while dq and dq[0] < cutoff:
            dq.popleft()
        if not dq:
            empty_keys.append(k)
    for k in empty_keys:
        _rate_buckets.pop(k, None)


async def _periodic_cleanup_loop() -> None:
    """Tâche de fond : purge les caches expirés toutes les 5 min."""
    while True:
        try:
            await asyncio.sleep(300)
            _cleanup_coach_cache()
            _cleanup_sessions()
            _cleanup_rate_buckets()
        except asyncio.CancelledError:
            break
        except Exception as e:
            log.warning("Periodic cleanup error: %s", e)


client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


# =============================================================================
# Database
# =============================================================================

def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        # WAL : écritures concurrentes (sendBeacon + post-call score sans contention)
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
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
    finally:
        conn.close()
    log.info("Database ready at %s (WAL)", DB_PATH)


# =============================================================================
# Helpers
# =============================================================================

def _format_history(history: list[dict]) -> str:
    return "\n".join(
        f"[{m.get('role', '?').upper()}] {m.get('text', '')}"
        for m in history
    )


def _sanitize_history(history: list[dict]) -> list[dict]:
    """Normalise + cap les tailles pour éviter de payer des tokens inutiles."""
    if not isinstance(history, list):
        return []
    clean: list[dict] = []
    for m in history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(m, dict):
            continue
        role = str(m.get("role", ""))[:16]
        text = str(m.get("text", ""))[:MAX_MESSAGE_TEXT_LEN]
        if text:
            clean.append({"role": role, "text": text})
    return clean


def _trim_history_for_coach(history: list[dict], turn_number: int) -> list[dict]:
    """
    Après le tour 6, le diagnostic est figé — on n'a plus besoin de renvoyer
    tout l'historique au coach. On garde les 12 derniers messages (tour courant
    + 5-6 tours de contexte closing).
    """
    if turn_number >= 6 and len(history) > 12:
        return history[-12:]
    return history


def _client_ip(request: web.Request) -> str:
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote or "0.0.0.0"


def _cors_headers(origin: str | None) -> dict[str, str]:
    """Headers CORS permissifs (le widget est embarqué sur domaines tiers)."""
    return {
        "Access-Control-Allow-Origin": origin or "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
    }


def _check_rate_limit(request: web.Request) -> web.Response | None:
    """Applique le rate limit sur les endpoints /api/*. None si OK, sinon 429."""
    path = request.path
    # Match exact d'abord, sinon prefix
    limit = RATE_LIMITS.get(path)
    if not limit:
        for prefix, lim in RATE_LIMITS.items():
            if path.startswith(prefix):
                limit = lim
                break
    if not limit:
        return None
    max_req, window = limit
    key = (_client_ip(request), path if path in RATE_LIMITS else prefix)
    dq = _rate_buckets.setdefault(key, deque())
    now = time.time()
    cutoff = now - window
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= max_req:
        retry = int(dq[0] + window - now) + 1
        return web.json_response(
            {"error": "rate_limited", "retry_after": retry},
            status=429,
            headers={"Retry-After": str(retry)},
        )
    dq.append(now)
    return None


def _require_valid_session(request: web.Request, session_id: str) -> bool:
    """
    Vérifie qu'un session_id a été émis par /api/session.
    En mode legacy (session non enregistrée), on accepte silencieusement
    pour ne pas casser les clients qui génèrent leur propre ID.
    """
    if not session_id:
        return True
    # Si aucune session enregistrée sur ce process, mode dégradé
    if not _valid_sessions:
        return True
    return session_id in _valid_sessions


# =============================================================================
# Endpoints
# =============================================================================

async def handle_session(request: web.Request) -> web.Response:
    """
    Émet un session_id signé, côté serveur (évite le spoofing client).
    Le client DOIT utiliser cet ID pour toutes les requêtes coach/briefing.
    """
    _cleanup_sessions()
    sid = "s_" + secrets.token_urlsafe(18)
    _valid_sessions[sid] = time.time()
    return web.json_response({"session_id": sid, "ttl_seconds": SESSION_TTL_SECONDS})


async def handle_token(request: web.Request) -> web.Response:
    """Provide API key for the frontend to connect to Gemini Live.

    Note : la tentative de token éphémère a été retirée — `auth_tokens.create`
    retourne le nom de la ressource (`auth_tokens/...`) qui ne peut pas être
    utilisé directement dans l'URL WS `?key=...` du SDK custom côté client.
    La vraie fix (proxy WS via backend) est un refacto à part.
    """
    if not GEMINI_API_KEY:
        return web.json_response({"error": "GEMINI_API_KEY not configured"}, status=500)
    return web.json_response({"token": GEMINI_API_KEY, "model": LIVE_MODEL})


async def handle_list_products(request: web.Request) -> web.Response:
    """List all ready products with the data the frontend needs to render."""
    products = []
    for pid, p in REGISTRY.products.items():
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
    """
    Return the universal multi-product SYSTEM_INSTRUCTION for the voice agent.
    Le prompt est compilé 1 seule fois au démarrage (CACHED_PROMPT).
    """
    agent_name = request.query.get("agent_name", DEFAULT_AGENT_NAME)
    if agent_name == CACHED_PROMPT_AGENT and CACHED_PROMPT:
        prompt = CACHED_PROMPT
    else:
        prompt = build_full_agent_prompt(REGISTRY, agent_name=agent_name)
    return web.json_response({
        "prompt": prompt,
        "agent_name": agent_name,
        "voice": "Puck",
        "live_model": LIVE_MODEL,
        "products_loaded": REGISTRY.list_ready(),
    })


async def handle_strategist(request: web.Request) -> web.Response:
    """Coach: analyze the conversation and return tactical directives as JSON."""
    if not client:
        return web.json_response({"error": "GEMINI_API_KEY not configured"}, status=500)
    try:
        data = await request.json()
        history = _sanitize_history(data.get("history", []))
        if not history:
            return web.json_response({"error": "empty history"}, status=400)

        turn_number = int(data.get("turn_number", 0) or 0)
        mode = data.get("mode", "mid_call")
        agent_name = data.get("agent_name", DEFAULT_AGENT_NAME)
        session_id = str(data.get("session_id", "default"))[:64]

        if not _require_valid_session(request, session_id):
            return web.json_response({"error": "invalid_session"}, status=403)

        # Optimisation coûts : après le tour 6 le diagnostic est figé, on coupe
        # l'historique envoyé au coach à 12 derniers messages.
        history = _trim_history_for_coach(history, turn_number)
        history_text = _format_history(history)
        base = build_coach_prompt(REGISTRY, agent_name=agent_name)

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
                f"Donne-lui la directive tactique la plus utile pour ce tour précis. "
                f"Rappel : produit non nommé avant tour 6, prix jamais avant tour 8."
            )

        full_prompt = base + history_text + suffix

        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=COACH_MODEL,
                contents=full_prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.3,
                    # 2048 pour laisser de la marge sur le post_call (JSON plus
                    # gros avec synthese finale). 1024 causait des invalid_json
                    # sur troncature.
                    "max_output_tokens": 2048,
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

        prod = coach_output.get("produit", {}) or {}
        log.info(
            "COACH [%s] turn=%s archetype=%s chaleur=%s produit=%s tier=%s certitude=%s",
            mode,
            turn_number,
            coach_output.get("archetype_detecte"),
            coach_output.get("etat_emotionnel", {}).get("chaleur"),
            prod.get("recommande"),
            prod.get("tier_recommande"),
            prod.get("certitude"),
        )

        coach_cache[session_id] = {
            "directive": coach_output,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "turn": turn_number,
        }

        return web.json_response(coach_output)
    except Exception as e:
        log.exception("Coach error")
        return web.json_response({"error": str(e)}, status=500)


async def handle_ui_dossier(request: web.Request) -> web.Response:
    """Ultra-fast dossier agent: extracts prospect info, cumulative + correctable."""
    if not client:
        return web.json_response({})
    try:
        data = await request.json()
        history = _sanitize_history(data.get("history", []))
        previous_dossier = data.get("previous_dossier", {})
        if not isinstance(previous_dossier, dict):
            previous_dossier = {}

        if not history:
            return web.json_response({})

        # Fenêtre élargie à 24 messages : l'agent doit pouvoir réauditer
        # son dossier précédent contre un contexte suffisant pour détecter
        # les corrections tardives ("ah non en fait je voulais dire X").
        recent = history[-24:] if len(history) > 24 else history
        history_text = _format_history(recent)

        prompt = build_ui_dossier_prompt(previous_dossier, history_text)

        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=DOSSIER_MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.05,  # ultra conservateur : zero invention
                    "max_output_tokens": 1024,
                    "thinking_config": {"thinking_budget": 128},  # raisonne avant d'extraire
                },
            )
        )

        try:
            return web.json_response(json.loads(response.text))
        except Exception as parse_err:
            log.warning("UI dossier JSON parse error: %s", parse_err)
            return web.json_response({})
    except Exception as e:
        log.exception("UI Dossier error")
        return web.json_response({})


# Historique des cartes affichées par session_id (anti-répétition cross-appels).
# TTL = 30 min (comme coach_cache), purge pilotée par le cleanup périodique.
_cards_session_history: dict[str, list[dict]] = {}

def _remember_card(session_id: str, card: dict) -> None:
    if not session_id or not card:
        return
    entry = {
        "key": card.get("image_key") or card.get("title") or "",
        "template": card.get("template") or "",
        "at": datetime.now(timezone.utc).isoformat(),
    }
    lst = _cards_session_history.setdefault(session_id, [])
    lst.append(entry)
    # Garde max 20 cartes par session
    if len(lst) > 20:
        _cards_session_history[session_id] = lst[-20:]


async def handle_ui_cards(request: web.Request) -> web.Response:
    """Agent cartes : choisit la meilleure carte à afficher, avec mémoire
    cross-appels + contexte riche (dossier + coach + historique cartes).
    """
    if not client:
        return web.json_response({"card": None})
    try:
        data = await request.json()
        history = _sanitize_history(data.get("history", []))
        active_product = data.get("active_product")
        if active_product and active_product not in REGISTRY.products:
            active_product = None
        session_id = str(data.get("session_id", "default"))[:64]
        dossier = data.get("dossier") or {}
        if not isinstance(dossier, dict):
            dossier = {}

        if not history:
            return web.json_response({"card": None})

        # Fenêtre historique élargie : 12 messages pour voir la trame long
        recent = history[-12:] if len(history) > 12 else history
        history_text = _format_history(recent)

        # Signaux coach (archétype, chaleur, certitude, produit)
        cached = coach_cache.get(session_id) or {}
        directive = cached.get("directive", {}) if isinstance(cached, dict) else {}
        coach_signals = {
            "archetype": directive.get("archetype_detecte"),
            "chaleur": (directive.get("etat_emotionnel", {}) or {}).get("chaleur"),
            "confiance_agent": (directive.get("etat_emotionnel", {}) or {}).get("confiance_agent"),
            "produit_certitude": (directive.get("produit", {}) or {}).get("certitude"),
            "signal_closing": (directive.get("directive_prochain_tour", {}) or {}).get("signal_closing"),
        }

        # Cartes déjà affichées dans cette session (anti-répétition)
        shown_cards = _cards_session_history.get(session_id, [])
        shown_summary = [
            f"{c['template'] or 'card'}:{c['key']}" for c in shown_cards[-12:]
        ]

        prompt = build_ui_cards_prompt(
            REGISTRY,
            history_text,
            active_product=active_product,
            dossier=dossier,
            coach_signals=coach_signals,
            shown_cards=shown_summary,
        )

        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=CARDS_MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.45,  # plus de créativité pour éviter les choix répétitifs
                    "max_output_tokens": 768,
                    "thinking_config": {"thinking_budget": 256},  # raisonne avant de répondre
                },
            )
        )

        try:
            result = json.loads(response.text)
        except Exception as parse_err:
            log.warning("UI cards JSON parse error: %s", parse_err)
            return web.json_response({"card": None})

        card = result.get("card") if isinstance(result, dict) else None

        # VERROU SERVEUR : cross-produit
        if card and active_product:
            img_key = card.get("image_key") or ""
            generic_keys = {"guarantee_generic", "offer_card"}
            if img_key and img_key not in generic_keys:
                owner = None
                for pid, p in REGISTRY.products.items():
                    imgs = p.images.get("images", []) if isinstance(p.images, dict) else []
                    if any(i.get("usage_card") == img_key for i in imgs):
                        owner = pid
                        break
                if owner and owner != active_product:
                    log.info(
                        "UI cards cross-product rejected: key=%s owner=%s active=%s",
                        img_key, owner, active_product,
                    )
                    return web.json_response({"card": None})

        # VERROU ANTI-RÉPÉTITION côté serveur : si la carte a déjà été affichée
        # dans cette session récemment, on la rejette.
        if card:
            key = card.get("image_key") or card.get("title") or ""
            if key and any(c["key"] == key for c in shown_cards[-10:]):
                log.info("UI cards repetition blocked: key=%s session=%s", key, session_id[:10])
                return web.json_response({"card": None, "reason": "already_shown"})
            # Mémorise cette carte pour les prochains appels
            _remember_card(session_id, card)

        log.info(
            "UI cards decided: tpl=%s key=%s reason=%s",
            (card or {}).get("template"),
            (card or {}).get("image_key") or (card or {}).get("title"),
            (result or {}).get("reasoning", "")[:80] if isinstance(result, dict) else "",
        )

        return web.json_response(result)
    except Exception as e:
        log.exception("UI Cards error")
        return web.json_response({"card": None})


async def handle_ui_director(request: web.Request) -> web.Response:
    """Legacy endpoint — forwards to the dossier agent."""
    return await handle_ui_dossier(request)


async def handle_briefing(request: web.Request) -> web.Response:
    """
    Tool calling endpoint: returns the coach directive + BM25 hits for the query.
    """
    try:
        data = await request.json()
        session_id = str(data.get("session_id", "default"))[:64]
        query = str((data.get("query") or data.get("user_message") or ""))[:500].strip()

        if not _require_valid_session(request, session_id):
            return web.json_response({"error": "invalid_session"}, status=403)

        cached = coach_cache.get(session_id)
        briefing = build_briefing_from_cache(cached, REGISTRY, query)
        return web.json_response(briefing)
    except Exception as e:
        log.exception("Briefing error")
        return web.json_response({"error": str(e)}, status=500)


async def handle_save_conversation(request: web.Request) -> web.Response:
    """Save a conversation transcript to SQLite."""
    try:
        # Pré-cap de taille pour éviter qu'un client injecte 100 Mo de texte
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

        transcript_text = "\n".join(
            f"[{m.get('role', '?').upper()}] {m.get('text', '')}" for m in messages
        )
        transcript_json = json.dumps(messages, ensure_ascii=False)

        ip = _client_ip(request)[:45]
        user_agent = request.headers.get("User-Agent", "")[:500]

        conn = sqlite3.connect(DB_PATH, timeout=5.0)
        try:
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
        finally:
            conn.close()

        log.info(
            "CONV #%s saved | product=%s duration=%ss messages=%d",
            conversation_id, product_id, duration, len(messages),
        )
        print(f"\n========== CONVERSATION #{conversation_id} (product={product_id}) ==========")
        print(transcript_text)
        print("=" * 60)

        return web.json_response({"status": "saved", "id": conversation_id})
    except Exception as e:
        log.exception("Save conversation error")
        return web.json_response({"error": str(e)}, status=500)


# =============================================================================
# MARKET DATA — indices live (CAC 40, or, Bitcoin, EUR/USD)
# =============================================================================

_MARKET_CACHE: dict = {"data": None, "ts": 0.0}
_MARKET_TTL = 600  # 10 min

async def _fetch_market_data() -> dict:
    """Récupère des données marché depuis des APIs gratuites sans auth.
    Dégrade gracieusement si une source fail."""
    import aiohttp as _aiohttp
    result: dict = {}

    # Yahoo Finance (CAC 40, Or spot, EUR/USD) — single batch call
    yh_url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=^FCHI,GC=F,EURUSD=X"
    yh_headers = {"User-Agent": "Mozilla/5.0 (Macintosh) Chrome/120"}
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.get(yh_url, headers=yh_headers, timeout=6) as r:
                if r.status == 200:
                    j = await r.json()
                    for q in j.get("quoteResponse", {}).get("result", []):
                        sym = q.get("symbol")
                        price = q.get("regularMarketPrice")
                        pct = q.get("regularMarketChangePercent")
                        if sym == "^FCHI":
                            result["cac40"] = {"price": price, "change_pct": pct, "unit": "pts"}
                        elif sym == "GC=F":
                            result["gold"] = {"price": price, "change_pct": pct, "unit": "$/oz"}
                        elif sym == "EURUSD=X":
                            result["eurusd"] = {"price": price, "change_pct": pct, "unit": ""}
    except Exception as e:
        log.debug("Yahoo market fetch failed: %s", e)

    # CoinGecko (Bitcoin) — rock-solid free API
    btc_url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur&include_24hr_change=true"
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.get(btc_url, timeout=6) as r:
                if r.status == 200:
                    j = await r.json()
                    btc = j.get("bitcoin", {})
                    if btc:
                        result["bitcoin"] = {
                            "price": btc.get("eur"),
                            "change_pct": btc.get("eur_24h_change"),
                            "unit": "€",
                        }
    except Exception as e:
        log.debug("CoinGecko fetch failed: %s", e)

    return result


async def handle_market(request: web.Request) -> web.Response:
    now = time.time()
    cached = _MARKET_CACHE.get("data")
    ts = _MARKET_CACHE.get("ts", 0.0)
    if cached and (now - ts) < _MARKET_TTL:
        return web.json_response({"data": cached, "cached": True, "age_s": int(now - ts)})
    try:
        data = await _fetch_market_data()
        if data:
            _MARKET_CACHE["data"] = data
            _MARKET_CACHE["ts"] = now
            return web.json_response({"data": data, "cached": False})
        # Rien reçu — retourne cache précédent si possible
        if cached:
            return web.json_response({"data": cached, "cached": True, "stale": True})
        return web.json_response({"data": {}, "error": "no_data_available"})
    except Exception as e:
        log.exception("Market fetch error")
        if cached:
            return web.json_response({"data": cached, "cached": True, "stale": True, "error": str(e)})
        return web.json_response({"data": {}, "error": str(e)}, status=500)


async def handle_list_conversations(request: web.Request) -> web.Response:
    """List latest 100 conversations (simple admin view)."""
    conn = sqlite3.connect(DB_PATH, timeout=5.0)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, started_at, duration_seconds, message_count, product_id, transcript
            FROM conversations
            ORDER BY id DESC
            LIMIT 100
        """)
        rows = cursor.fetchall()
    finally:
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
    """Serve static frontend files — path traversal hardened."""
    raw = request.match_info.get("path", "index.html") or "index.html"
    # Reject leading slashes, NULs, and any .. segment even url-decoded
    if "\x00" in raw or raw.startswith("/"):
        return web.Response(status=400)
    candidate = (FRONTEND_DIR / raw)
    try:
        file_path = candidate.resolve(strict=False)
    except Exception:
        return web.Response(status=400)
    # Strict containment check after resolve (vérifie tout symlink-escape)
    try:
        file_path.relative_to(FRONTEND_DIR)
    except ValueError:
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

app = web.Application(client_max_size=MAX_PAYLOAD_BYTES)
app.router.add_get("/api/products", handle_list_products)
app.router.add_post("/api/token", handle_token)
app.router.add_post("/api/session", handle_session)
app.router.add_get("/api/prompt", handle_prompt)
app.router.add_post("/api/strategist", handle_strategist)
app.router.add_post("/api/ui-director", handle_ui_director)  # legacy
app.router.add_post("/api/ui-dossier", handle_ui_dossier)
app.router.add_post("/api/ui-cards", handle_ui_cards)
app.router.add_post("/api/briefing", handle_briefing)
app.router.add_post("/api/save-conversation", handle_save_conversation)
app.router.add_get("/api/conversations", handle_list_conversations)
app.router.add_get("/api/market", handle_market)
app.router.add_get("/", handle_static)
app.router.add_get("/{path:.*}", handle_static)


# Security + CORS middleware
@web.middleware
async def security_middleware(request: web.Request, handler):
    origin = request.headers.get("Origin")

    # Preflight
    if request.method == "OPTIONS":
        return web.Response(headers=_cors_headers(origin))

    # Rate limiting
    if request.path.startswith("/api/"):
        rl = _check_rate_limit(request)
        if rl is not None:
            for k, v in _cors_headers(origin).items():
                rl.headers[k] = v
            return rl

    response = await handler(request)

    # CORS echo
    for k, v in _cors_headers(origin).items():
        response.headers[k] = v

    # Security headers (niveau raisonnable sans casser le widget embarqué)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    # HSTS actif uniquement si on sait qu'on est derrière HTTPS (Railway)
    if request.headers.get("X-Forwarded-Proto") == "https":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    # CSP léger : autorise Gemini WS + fonts Google + images externes + AudioWorklet (blob:)
    if request.path.startswith("/api/") is False:
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' blob:; "
            "script-src-elem 'self' 'unsafe-inline' blob:; "
            "worker-src 'self' blob:; "
            "child-src 'self' blob:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' https: data:; "
            "media-src 'self' blob: data:; "
            "connect-src 'self' https: wss://generativelanguage.googleapis.com https://script.google.com;",
        )
    return response


app.middlewares.append(security_middleware)
app.router.add_route("OPTIONS", "/{path:.*}", lambda r: web.Response())


async def _on_startup(app: web.Application) -> None:
    app["cleanup_task"] = asyncio.create_task(_periodic_cleanup_loop())


async def _on_cleanup(app: web.Application) -> None:
    task = app.get("cleanup_task")
    if task:
        task.cancel()
        try:
            await task
        except Exception:
            pass


app.on_startup.append(_on_startup)
app.on_cleanup.append(_on_cleanup)


if __name__ == "__main__":
    init_db()
    reg = init_products()
    log.info(
        "Loaded %d products: %s",
        len(reg.products),
        ", ".join(reg.list_ready()),
    )

    # Compile le system prompt UNE fois (évite reconstruction à chaque /api/prompt)
    CACHED_PROMPT = build_full_agent_prompt(reg, agent_name=DEFAULT_AGENT_NAME)
    log.info("System prompt cached (%d chars)", len(CACHED_PROMPT))

    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY not set. Create a .env file with your key.")
        log.warning("Get one at: https://aistudio.google.com/apikey")

    port = int(os.getenv("PORT", "8000"))
    log.info("Server starting on port %d", port)
    web.run_app(app, host="0.0.0.0", port=port)
