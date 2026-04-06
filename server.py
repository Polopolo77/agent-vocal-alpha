import os
import json
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

from aiohttp import web
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FRONTEND_DIR = Path(__file__).parent / "frontend"

client = genai.Client(api_key=GEMINI_API_KEY)


async def handle_token(request):
    """Provide API key for the frontend to connect to Gemini Live."""
    if not GEMINI_API_KEY:
        return web.json_response({"error": "GEMINI_API_KEY not configured"}, status=500)
    return web.json_response(
        {"token": GEMINI_API_KEY, "model": "gemini-3.1-flash-live-preview"}
    )


async def handle_static(request):
    """Serve static frontend files."""
    path = request.match_info.get("path", "index.html")
    if not path or path == "/":
        path = "index.html"

    # Prevent directory traversal
    file_path = (FRONTEND_DIR / path).resolve()
    if not str(file_path).startswith(str(FRONTEND_DIR.resolve())):
        return web.Response(status=403)

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


app = web.Application()
app.router.add_post("/api/token", handle_token)
app.router.add_get("/", handle_static)
app.router.add_get("/{path:.*}", handle_static)

if __name__ == "__main__":
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY not set. Create a .env file with your key.")
        print("Get one at: https://aistudio.google.com/apikey")
    print(f"Server starting on http://localhost:8000")
    web.run_app(app, host="0.0.0.0", port=8000)
