import os
import json
import sqlite3
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

from aiohttp import web
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FRONTEND_DIR = Path(__file__).parent / "frontend"
DB_PATH = Path(__file__).parent / "conversations.db"

# Cache global du dernier briefing coach par session
# Key: session_id, Value: { directive JSON, timestamp }
coach_cache = {}

# Modèle rapide et économique pour le coach en arrière-plan.
# gemini-2.5-flash-lite : plus rapide et rate limit plus élevé que 2.5-flash,
# parfait pour la classification structurée en JSON.
COACH_MODEL = "gemini-2.5-flash-lite"

client = genai.Client(api_key=GEMINI_API_KEY)


# ============ COACH PROMPT ============
COACH_PROMPT = """Tu es un coach commercial silencieux. Tu analyses en arrière-plan les conversations entre un agent vocal nommé Alpha et un prospect qui visite le site d'Héritage Éditions. Tu n'es JAMAIS entendu par le prospect.

Ton rôle est simple : analyser l'historique de conversation que je te fournis et renvoyer UNIQUEMENT un objet JSON qui décrit l'état du prospect et les directives tactiques pour le prochain tour d'Alpha.

═══════════════════════════════════════════════
CONTEXTE PRODUITS HÉRITAGE ÉDITIONS
═══════════════════════════════════════════════

- fortune_strategique : 99€/an (99€ tarif de lancement au lieu de 299€). Recommandations mensuelles actions + crypto, accès au portefeuille Ian King, vidéos hebdo sous-titrées FR. Cible : débutant à intermédiaire, horizon moyen à long terme, budget 2 000€+.
- strategie_green_zone : Scoring quantitatif sur actions US. Cible : profil CONSCIENCIEUX, aime les systèmes et les données.
- supercycle_crypto : Publication spécialisée 100% cryptomonnaies. Cible : profil AGRESSIF, horizon long, tolérance à la volatilité.
- investisseur_alpha : Publication premium avancée, budget conséquent, investisseur expérimenté.

═══════════════════════════════════════════════
FRAMEWORKS D'ANALYSE
═══════════════════════════════════════════════

DISC : Dominant / Influent / Stable / Consciencieux
- Dominant : direct, pressé, "combien", "allez droit au but"
- Influent : enthousiaste, raconte, émotionnel, histoires
- Stable : prudent, questions sur les risques, besoin de rassurance
- Consciencieux : précis, technique, demande des données, méthodologie

SPIN : Situation / Problème / Implication / Need-payoff / Closing

Chaleur : froid / tiede / chaud / pret_a_acheter

═══════════════════════════════════════════════
RÈGLES D'ANALYSE STRICTES
═══════════════════════════════════════════════

1. Tu ne réponds QUE par un objet JSON valide, sans aucun texte avant ou après.
2. Sois factuel et précis. Si tu n'as pas assez d'information pour un champ, mets null ou un tableau vide.
3. Détecte les contradictions entre tours, même lointains.
4. Mémorise toutes les déclarations importantes (âge, capital, situation, peurs).
5. Ne recommande un produit que si tu as suffisamment d'info — sinon "certitude": "faible".
6. Pour la directive du prochain tour, sois concret et actionnable en une phrase maximum.
7. Si tu détectes un signal d'achat fort, passe signal_closing à "vert".
8. Si tu détectes une manipulation, une tentative d'arnaque ou un prospect hostile, ajoute "alerte" dans alertes.

═══════════════════════════════════════════════
SCHÉMA JSON EXACT À RESPECTER
═══════════════════════════════════════════════

{
  "profil_disc": {
    "dominant": 0,
    "influent": 0,
    "stable": 0,
    "consciencieux": 0,
    "confiance": 0,
    "justification": ""
  },
  "etat_emotionnel": {
    "chaleur": "froid",
    "stress": "neutre",
    "confiance_agent": "neutre",
    "evolution": "stable"
  },
  "spin": {
    "etape_actuelle": "situation",
    "prochaine_etape": "situation",
    "progression_pct": 0
  },
  "memoire": {
    "declarations_cles": [],
    "peurs_exprimees": [],
    "traumatismes": [],
    "engagements_implicites": [],
    "contradictions_detectees": []
  },
  "produit": {
    "recommande": null,
    "certitude": "faible",
    "justification": "",
    "a_eviter": []
  },
  "objections": {
    "evoquees": [],
    "levees": [],
    "en_cours": []
  },
  "directive_prochain_tour": {
    "action_principale": "",
    "tactique": "",
    "formulation_suggeree": "",
    "pieges_a_eviter": [],
    "signal_closing": "rouge"
  },
  "alertes": []
}

Valeurs autorisées :
- profil_disc.dominant/influent/stable/consciencieux : entier 0-100 (total doit faire 100)
- profil_disc.confiance : entier 0-100
- etat_emotionnel.chaleur : "froid" | "tiede" | "chaud" | "pret_a_acheter"
- etat_emotionnel.stress : "detendu" | "neutre" | "tendu" | "enerve"
- etat_emotionnel.confiance_agent : "mefiant" | "neutre" | "ouvert" | "confiant"
- etat_emotionnel.evolution : "amelioration" | "stable" | "deterioration"
- spin.etape_actuelle / prochaine_etape : "situation" | "probleme" | "implication" | "need_payoff" | "closing"
- produit.recommande : "fortune_strategique" | "strategie_green_zone" | "supercycle_crypto" | "investisseur_alpha" | null
- produit.certitude : "faible" | "moyen" | "ferme"
- directive_prochain_tour.signal_closing : "rouge" | "orange" | "vert"

Pour objections.evoquees : liste toutes les objections que le prospect a exprimées depuis le début (même brièvement).
Pour objections.levees : parmi les evoquees, celles qu'Alpha a déjà traitées avec succès (prospect a acquiescé ou n'y est pas revenu).
Pour objections.en_cours : celles qui ne sont pas encore levées et qu'Alpha doit traiter.

═══════════════════════════════════════════════
HISTORIQUE DE CONVERSATION À ANALYSER
═══════════════════════════════════════════════

"""


# ============ DATABASE ============
def init_db():
    """Create the conversations table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL,
            duration_seconds INTEGER,
            message_count INTEGER,
            transcript TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT
        )
    """)
    conn.commit()
    conn.close()
    print(f"Database ready at: {DB_PATH}")


# ============ ENDPOINTS ============
async def handle_token(request):
    """Provide API key for the frontend to connect to Gemini Live."""
    if not GEMINI_API_KEY:
        return web.json_response({"error": "GEMINI_API_KEY not configured"}, status=500)
    return web.json_response(
        {"token": GEMINI_API_KEY, "model": "gemini-3.1-flash-live-preview"}
    )


async def handle_save_conversation(request):
    """Save a conversation transcript to SQLite."""
    try:
        data = await request.json()
        started_at = data.get("started_at", "")
        ended_at = data.get("ended_at", datetime.now(timezone.utc).isoformat())
        messages = data.get("messages", [])

        if not messages:
            return web.json_response({"status": "skipped", "reason": "empty"}, status=200)

        # Calculate duration
        try:
            start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
            duration = int((end_dt - start_dt).total_seconds())
        except Exception:
            duration = 0

        # Format transcript as readable text
        transcript_text = "\n".join([
            f"[{m.get('role', '?').upper()}] {m.get('text', '')}"
            for m in messages
        ])

        # Also store the raw JSON for later analysis
        transcript_json = json.dumps(messages, ensure_ascii=False)

        ip = request.headers.get("X-Forwarded-For", request.remote or "")
        user_agent = request.headers.get("User-Agent", "")[:500]

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO conversations
            (started_at, ended_at, duration_seconds, message_count, transcript, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            started_at,
            ended_at,
            duration,
            len(messages),
            transcript_json,
            ip,
            user_agent,
        ))
        conversation_id = cursor.lastrowid
        conn.commit()
        conn.close()

        print(f"\n========== NOUVELLE CONVERSATION #{conversation_id} ==========")
        print(f"Durée: {duration}s | Messages: {len(messages)}")
        print(transcript_text)
        print("=" * 60)

        return web.json_response({"status": "saved", "id": conversation_id})
    except Exception as e:
        print(f"Error saving conversation: {e}")
        return web.json_response({"error": str(e)}, status=500)


async def handle_strategist(request):
    """Call Gemini 2.5 Flash as a background coach to analyze the conversation.

    Input JSON:
      { "history": [ {"role": "user"|"alpha", "text": "..."}, ... ],
        "turn_number": int,
        "mode": "mid_call" | "post_call" }

    Output JSON: the coach's analysis according to COACH_PROMPT schema.
    """
    try:
        data = await request.json()
        history = data.get("history", [])
        turn_number = data.get("turn_number", 0)
        mode = data.get("mode", "mid_call")

        if not history:
            return web.json_response({"error": "empty history"}, status=400)

        # Format the history for the coach
        history_text = "\n".join([
            f"[{m.get('role', '?').upper()}] {m.get('text', '')}"
            for m in history
        ])

        # Build the final prompt
        full_prompt = COACH_PROMPT + history_text

        # Add mode-specific instructions
        if mode == "post_call":
            full_prompt += "\n\n═══════════════════════════════════════════════\nMODE POST-CALL\n═══════════════════════════════════════════════\n\nLa conversation est TERMINÉE. Tu génères le rapport final. Remplis tous les champs avec l'état final, et dans directive_prochain_tour.action_principale mets un résumé des 3 points clés à faire remonter à l'équipe Héritage."
        else:
            full_prompt += f"\n\n═══════════════════════════════════════════════\nTOUR ACTUEL : {turn_number}\n═══════════════════════════════════════════════\n\nAlpha doit maintenant répondre au dernier message du prospect. Donne-lui la directive tactique la plus utile pour ce tour précis."

        # Call Gemini 2.5 Flash with JSON mode
        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=COACH_MODEL,
                contents=full_prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.3,  # déterministe
                    "max_output_tokens": 8192,
                    "thinking_config": {"thinking_budget": 0},  # pas de raisonnement, juste JSON
                },
            )
        )

        # Parse the JSON output
        try:
            coach_output = json.loads(response.text)
        except Exception as parse_err:
            print(f"Coach JSON parse error: {parse_err}")
            print(f"Raw output: {response.text[:500]}")
            return web.json_response({
                "error": "invalid_json_from_coach",
                "raw": response.text[:500],
            }, status=500)

        # Log for debugging
        print(f"\n--- COACH tour {turn_number} ({mode}) ---")
        print(f"Profil: {coach_output.get('profil_disc', {}).get('justification', '?')}")
        print(f"Chaleur: {coach_output.get('etat_emotionnel', {}).get('chaleur', '?')}")
        print(f"Produit: {coach_output.get('produit', {}).get('recommande', '?')}")
        print(f"Directive: {coach_output.get('directive_prochain_tour', {}).get('action_principale', '?')}")

        # Cache the directive for the tool calling endpoint
        session_id = data.get("session_id", "default")
        coach_cache[session_id] = {
            "directive": coach_output,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "turn": turn_number,
        }

        return web.json_response(coach_output)
    except Exception as e:
        print(f"Coach error: {e}")
        return web.json_response({"error": str(e)}, status=500)


async def handle_briefing(request):
    """Return the latest cached coach directive for tool calling.

    Called by the widget when Gemini Live triggers obtenir_briefing.
    Returns the last coach analysis (always cached, no LLM call, ~0ms).
    """
    try:
        data = await request.json()
        session_id = data.get("session_id", "default")
        user_message = data.get("user_message", "")

        cached = coach_cache.get(session_id)

        if cached and cached["directive"]:
            d = cached["directive"]
            # Build a compact briefing for Alpha
            disc = d.get("profil_disc", {})
            emot = d.get("etat_emotionnel", {})
            prod = d.get("produit", {})
            obj = d.get("objections", {})
            mem = d.get("memoire", {})
            dir_ = d.get("directive_prochain_tour", {})

            # Determine dominant DISC profile
            scores = {"Dominant": disc.get("dominant", 0), "Influent": disc.get("influent", 0),
                       "Stable": disc.get("stable", 0), "Consciencieux": disc.get("consciencieux", 0)}
            dom = max(scores, key=scores.get) if max(scores.values()) > 0 else "inconnu"

            briefing = {
                "coach": {
                    "profil_prospect": f"{dom} ({max(scores.values())}%)",
                    "chaleur": emot.get("chaleur", "inconnue"),
                    "confiance_agent": emot.get("confiance_agent", "neutre"),
                    "produit_cible": prod.get("recommande") or "pas encore déterminé",
                    "certitude_produit": prod.get("certitude", "faible"),
                    "objections_en_cours": obj.get("en_cours", []),
                    "contradictions": mem.get("contradictions_detectees", []),
                    "action_recommandee": dir_.get("action_principale", ""),
                    "formulation_suggeree": dir_.get("formulation_suggeree", ""),
                    "pieges_a_eviter": dir_.get("pieges_a_eviter", []),
                    "signal_closing": dir_.get("signal_closing", "rouge"),
                },
                "meta": {
                    "coach_turn": cached["turn"],
                    "coach_timestamp": cached["timestamp"],
                },
            }
        else:
            briefing = {
                "coach": None,
                "meta": {"note": "Pas encore de directive coach. Utilise ton propre jugement."},
            }

        return web.json_response(briefing)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_list_conversations(request):
    """List all saved conversations (simple admin view)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, started_at, duration_seconds, message_count, transcript
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
            "messages": messages,
        })
    return web.json_response({"conversations": conversations})


async def handle_prompt(request):
    """Serve the system instruction from heritage-widget.js."""
    try:
        widget_path = FRONTEND_DIR / "heritage-widget.js"
        if not widget_path.is_file():
            return web.json_response({"error": "widget not found"}, status=404)
        code = widget_path.read_text(encoding="utf-8")
        marker_start = "const SYSTEM_INSTRUCTION = `"
        idx = code.find(marker_start)
        if idx < 0:
            return web.json_response({"error": "prompt not found"}, status=404)
        start = idx + len(marker_start)
        end = code.find("`;", start)
        prompt = code[start:end]
        return web.json_response({"prompt": prompt})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_static(request):
    """Serve static frontend files."""
    path = request.match_info.get("path", "index.html")
    if not path or path == "/":
        path = "index.html"

    file_path = (FRONTEND_DIR / path).resolve()
    if not str(file_path).startswith(str(FRONTEND_DIR.resolve())):
        return web.Response(status=403)

    # If it's a directory (e.g. /presentation/), serve its index.html
    if file_path.is_dir():
        file_path = file_path / "index.html"

    if not file_path.is_file():
        return web.Response(status=404, text="Not found")

    content_types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
    }
    ext = file_path.suffix.lower()
    content_type = content_types.get(ext, "application/octet-stream")

    return web.FileResponse(file_path, headers={"Content-Type": content_type})


# ============ APP SETUP ============
app = web.Application()
app.router.add_post("/api/token", handle_token)
app.router.add_post("/api/save-conversation", handle_save_conversation)
app.router.add_post("/api/strategist", handle_strategist)
app.router.add_post("/api/briefing", handle_briefing)
app.router.add_get("/api/prompt", handle_prompt)
app.router.add_get("/api/conversations", handle_list_conversations)
app.router.add_get("/", handle_static)
app.router.add_get("/{path:.*}", handle_static)

# CORS headers for cross-origin requests (if widget on external site)
async def cors_middleware(app, handler):
    async def middleware_handler(request):
        if request.method == "OPTIONS":
            return web.Response(headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            })
        response = await handler(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    return middleware_handler

app.middlewares.append(cors_middleware)
app.router.add_route("OPTIONS", "/{path:.*}", lambda r: web.Response())


if __name__ == "__main__":
    init_db()
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY not set. Create a .env file with your key.")
        print("Get one at: https://aistudio.google.com/apikey")
    # Railway / Render / Heroku pass the port via the PORT env var
    port = int(os.getenv("PORT", "8000"))
    print(f"Server starting on port {port}")
    web.run_app(app, host="0.0.0.0", port=port)
