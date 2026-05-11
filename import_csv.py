#!/usr/bin/env python3
"""Import conversations from CSV to Railway backend."""

import csv
import json
import re
import ssl
import sys
from datetime import datetime, timedelta, timezone
import urllib.request

API_URL = "https://web-production-572b6.up.railway.app/api/save-conversation"
CSV_PATH = "/Users/pchenal/Downloads/trinity sphere - Feuille 1.csv"


def parse_date(date_str: str) -> datetime:
    """Parse DD/MM/YYYY HH:MM:SS to datetime (UTC)."""
    return datetime.strptime(date_str.strip(), "%d/%m/%Y %H:%M:%S").replace(tzinfo=timezone.utc)


def parse_transcript(transcript: str) -> list[dict]:
    """Split transcript on [ASSISTANT] and [USER] prefixes into messages."""
    messages = []
    # Split on [ASSISTANT] or [USER] tags, keeping the tag
    parts = re.split(r'\[(ASSISTANT|USER)\]\s*', transcript.strip())
    # parts[0] is empty or whitespace before first tag
    # Then alternating: tag, content, tag, content...
    i = 1
    while i < len(parts) - 1:
        role_tag = parts[i].strip().lower()
        text = parts[i + 1].strip()
        if text:
            messages.append({"role": role_tag, "text": text})
        i += 2
    return messages


def post_conversation(data: dict) -> tuple[bool, str]:
    """POST a conversation to the backend. Returns (success, message)."""
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    # macOS Python often lacks system certs; use unverified context as fallback
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
    except ImportError:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return True, f"{resp.status}"
    except Exception as e:
        return False, str(e)


def main():
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)

    print(f"Found {len(rows)} conversations to import.\n")

    success_count = 0
    fail_count = 0

    for i, row in enumerate(rows):
        date_str = row[0]
        duration_s = int(row[1])
        nb_messages = row[2]
        transcript = row[3]
        agent = row[4].strip()

        started_at = parse_date(date_str)
        ended_at = started_at + timedelta(seconds=duration_s)
        messages = parse_transcript(transcript)

        payload = {
            "started_at": started_at.isoformat().replace("+00:00", "Z"),
            "ended_at": ended_at.isoformat().replace("+00:00", "Z"),
            "messages": messages,
            "product_id": agent,
        }

        ok, msg = post_conversation(payload)
        status = "OK" if ok else "FAIL"
        if ok:
            success_count += 1
        else:
            fail_count += 1

        print(f"[{i+1}/{len(rows)}] {status} | {date_str} | {len(messages)} msgs | {msg}")

    print(f"\nDone. {success_count} succeeded, {fail_count} failed.")


if __name__ == "__main__":
    main()
