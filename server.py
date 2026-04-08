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

client = genai.Client(api_key=GEMINI_API_KEY)


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
