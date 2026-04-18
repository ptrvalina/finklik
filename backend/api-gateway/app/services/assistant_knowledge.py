"""
Справочная база для ИИ-консультанта: курируемые фрагменты + каталог источников (госпорталы, Pravo.by, СПС).

Полные тексты НПА в репозиторий не копируются — только краткие ориентиры и ссылки на официальные ресурсы.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "assistant_knowledge"

_STOP = frozenset(
    """
    и в во не на что за по из к как а о об от до при для или же то есть
    """.split()
)


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^\w\s\-]", " ", text, flags=re.UNICODE)
    parts = [p for p in text.split() if len(p) > 1 and p not in _STOP]
    return parts


def _score_chunk(query_tokens: set[str], chunk: dict[str, Any]) -> float:
    score = 0.0
    tags = [t.lower() for t in chunk.get("tags") or []]
    title = (chunk.get("title") or "").lower()
    body = (chunk.get("body") or "").lower()
    for w in query_tokens:
        if w in tags:
            score += 3.0
        if w in title:
            score += 2.0
        if w in body:
            score += 1.0
    return score


@lru_cache(maxsize=1)
def _load_chunks_raw() -> list[dict[str, Any]]:
    path = _DATA_DIR / "chunks.json"
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        chunks = raw.get("chunks") if isinstance(raw, dict) else []
        return [c for c in chunks if isinstance(c, dict) and c.get("id") and c.get("body")]
    except Exception:
        return []


@lru_cache(maxsize=1)
def _load_catalog_raw() -> dict[str, Any]:
    path = _DATA_DIR / "sources_catalog.json"
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def retrieve_for_query(user_text: str, limit: int = 6) -> tuple[list[dict[str, Any]], str]:
    """
    Возвращает отобранные чанки и текстовый блок для system prompt (RAG).
    """
    chunks = _load_chunks_raw()
    if not chunks or not (user_text or "").strip():
        return [], ""

    q_tokens = set(_tokenize(user_text))
    if not q_tokens:
        return [], ""

    scored: list[tuple[float, dict[str, Any]]] = []
    for c in chunks:
        s = _score_chunk(q_tokens, c)
        if s > 0:
            scored.append((s, c))

    scored.sort(key=lambda x: -x[0])
    top = [c for _, c in scored[:limit]]

    if not top:
        top = chunks[: min(3, len(chunks))]

    lines: list[str] = []
    for c in top:
        cid = c.get("id", "")
        title = c.get("title", "")
        body = (c.get("body") or "").strip()
        urls = c.get("primary_urls") or []
        url_str = (" · ").join(urls) if urls else "ссылка уточняется по типу источника"
        lines.append(f"[{cid}] {title}\n{body}\nПервоисточники/порталы: {url_str}")

    block = (
        "Ниже — внутренние ориентиры из справочной базы ФинКлик (не полные тексты законов). "
        "При ответе ссылайся на id в квадратных скобках, если используешь фрагмент; обязательно направляй пользователя к Pravo.by и официальным порталам для проверки.\n\n"
        + "\n\n---\n\n".join(lines)
    )
    return top, block


def format_sources_for_api(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for c in chunks:
        urls = c.get("primary_urls") or []
        out.append(
            {
                "id": c.get("id"),
                "title": c.get("title"),
                "url": urls[0] if urls else None,
                "authority": c.get("authority"),
                "kinds": c.get("kinds") or [],
            }
        )
    return out


def get_sources_catalog() -> dict[str, Any]:
    return _load_catalog_raw()


def append_demo_sources_footer(user_text: str) -> str:
    """Для демо-режима без LLM — краткий список релевантных источников."""
    top, _ = retrieve_for_query(user_text, limit=4)
    if not top:
        return ""
    lines = ["", "", "**Ориентиры по источникам (проверяйте на официальных сайтах):**"]
    for c in top:
        urls = c.get("primary_urls") or []
        u = urls[0] if urls else None
        title = c.get("title") or c.get("id")
        if u:
            lines.append(f"• {title} — {u}")
        else:
            lines.append(f"• {title}")
    return "\n".join(lines)
