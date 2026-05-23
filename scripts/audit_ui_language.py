#!/usr/bin/env python3
"""Грубый аудит EN-строк во фронте (для Part 1 RU localization)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONT = ROOT / "frontend" / "web" / "src"

# Подозрительные латинские фразы в UI (не технические идентификаторы).
PATTERN = re.compile(
    r'(?:label|title|placeholder|description|body|message)\s*[:=]\s*["\']([A-Za-z][A-Za-z\s]{3,60})["\']'
)

SKIP = {"GET", "POST", "PUT", "PATCH", "DELETE", "OK", "API", "URL", "PDF", "OCR", "JSON", "HTTP", "HTTPS"}


def main() -> int:
    hits: list[str] = []
    for path in FRONT.rglob("*.{tsx,ts}"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for m in PATTERN.finditer(text):
            phrase = m.group(1).strip()
            if phrase.upper() in SKIP:
                continue
            if phrase.startswith("http"):
                continue
            hits.append(f"{path.relative_to(ROOT)}: {phrase}")
    if not hits:
        print("No obvious English UI label patterns found (heuristic).")
        return 0
    print(f"Found {len(hits)} candidate English UI strings:\n")
    for line in sorted(set(hits))[:80]:
        print(" -", line)
    if len(hits) > 80:
        print(f"... and {len(hits) - 80} more")
    return 1


if __name__ == "__main__":
    sys.exit(main())
