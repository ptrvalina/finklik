"""
Справочная база для ИИ-консультанта: курируемые фрагменты + каталог источников (госпорталы, Pravo.by, СПС).

Полные тексты НПА в репозиторий не копируются — только краткие ориентиры и ссылки на официальные ресурсы.
Каталог `sources_catalog.json` дополнительно разворачивается в «виртуальные» чанки для поиска по названиям порталов.
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

# Расширение запроса синонимами/смежными терминами (рус.), без «шума» из однобуквенных совпадений.
_TOKEN_EXPAND: dict[str, frozenset[str]] = {
    "мнс": frozenset(["имнс", "налог", "мнс"]),
    "имнс": frozenset(["мнс", "налог", "декларация"]),
    "налогов": frozenset(["имнс", "мнс", "налог"]),
    "пу3": frozenset(["пу-3", "фсзн", "пу"]),
    "пу-3": frozenset(["фсзн", "персонифиц", "пу"]),
    "ндс": frozenset(["налог", "декларация", "имнс"]),
    "взнос": frozenset(["фсзн", "страхов"]),
    "страхов": frozenset(["фсзн", "белгосстрах", "взнос"]),
    "зарплат": frozenset(["фсзн", "пу-3", "работник"]),
    "курс": frozenset(["нбрб", "валют", "byn"]),
    "валют": frozenset(["нбрб", "курс"]),
    "унп": frozenset(["егр", "контрагент"]),
    "контрагент": frozenset(["унп", "егр"]),
    "статистик": frozenset(["белстат", "форма"]),
    "отчёт": frozenset(["белстат", "имнс", "фсзн", "сдача"]),
    "отчет": frozenset(["белстат", "имнс", "фсзн", "сдача"]),
    "1с": frozenset(["синхронизация", "контур"]),
    "одинс": frozenset(["1с", "синхронизация"]),
}


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^\w\s\-]", " ", text, flags=re.UNICODE)
    parts = [p for p in text.split() if len(p) > 1 and p not in _STOP]
    return parts


def _expand_tokens(tokens: set[str]) -> set[str]:
    out = set(tokens)
    for t in list(tokens):
        out |= _TOKEN_EXPAND.get(t, frozenset())
    return out


def _tag_match_score(word: str, tag: str) -> float:
    """Частичное совпадение для коротких тегов и основ слов (без полноценной морфологии)."""
    if len(word) < 3:
        return 0.0
    if word == tag:
        return 2.5
    if len(word) >= 4 and (tag.startswith(word) or word.startswith(tag)):
        return 1.8
    if len(tag) >= 5 and word in tag:
        return 1.2
    if len(word) >= 5 and tag in word:
        return 1.2
    return 0.0


def _score_chunk(query_tokens: set[str], chunk: dict[str, Any]) -> float:
    score = 0.0
    tags = [t.lower() for t in chunk.get("tags") or []]
    title = (chunk.get("title") or "").lower()
    body = (chunk.get("body") or "").lower()
    for w in query_tokens:
        for tag in tags:
            score += _tag_match_score(w, tag)
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


def _catalog_to_virtual_chunks(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for g in catalog.get("groups") or []:
        if not isinstance(g, dict):
            continue
        gid = str(g.get("id") or "grp")
        gtitle = str(g.get("title") or "")
        for i, e in enumerate(g.get("entries") or []):
            if not isinstance(e, dict):
                continue
            title = str(e.get("title") or "").strip()
            note = str(e.get("note") or "").strip()
            url = e.get("url")
            body = (note + "\nРаздел каталога: " + gtitle).strip()
            tag_src = f"{title} {note} {gtitle}"
            tags = list(dict.fromkeys(_tokenize(tag_src)))[:50]
            out.append(
                {
                    "id": f"cat-{gid}-{i}",
                    "title": title or gtitle,
                    "authority": gid.split("_")[0] if gid else "general",
                    "tags": tags,
                    "body": body,
                    "primary_urls": [url] if isinstance(url, str) and url.strip() else [],
                    "kinds": ["catalog"],
                }
            )
    return out


def _all_chunks() -> list[dict[str, Any]]:
    return list(_load_chunks_raw()) + _catalog_to_virtual_chunks(_load_catalog_raw())


def retrieve_for_query(user_text: str, limit: int = 6) -> tuple[list[dict[str, Any]], str]:
    """
    Возвращает отобранные чанки и текстовый блок для system prompt (RAG).
    """
    chunks = _all_chunks()
    if not chunks or not (user_text or "").strip():
        return [], ""

    q_tokens = _expand_tokens(set(_tokenize(user_text)))
    if not q_tokens:
        return [], ""

    scored: list[tuple[float, dict[str, Any]]] = []
    for c in chunks:
        s = _score_chunk(q_tokens, c)
        if s > 0:
            scored.append((s, c))

    scored.sort(key=lambda x: -x[0])
    top = [c for _, c in scored[: limit * 2]]

    # Дедупликация: приоритет у «основных» чанков (не cat-*), затем по первому URL.
    seen_ids: set[str] = set()
    seen_urls: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for c in top:
        cid = str(c.get("id") or "")
        if cid in seen_ids:
            continue
        urls = c.get("primary_urls") or []
        u0 = urls[0] if urls and isinstance(urls[0], str) else None
        if u0 and u0 in seen_urls and cid.startswith("cat-"):
            continue
        seen_ids.add(cid)
        if u0:
            seen_urls.add(u0)
        deduped.append(c)
        if len(deduped) >= limit:
            break

    if not deduped:
        deduped = chunks[: min(3, len(chunks))]

    lines: list[str] = []
    for c in deduped:
        cid = c.get("id", "")
        title = c.get("title", "")
        body = (c.get("body") or "").strip()
        urls = c.get("primary_urls") or []
        url_str = (" · ").join(u for u in urls if isinstance(u, str) and u.strip()) or "ссылка уточняется по типу источника"
        lines.append(f"[{cid}] {title}\n{body}\nПервоисточники/порталы: {url_str}")

    block = (
        "Ниже — внутренние ориентиры из справочной базы ФинКлик (не полные тексты законов). "
        "При ответе ссылайся на id в квадратных скобках, если используешь фрагмент; обязательно направляй пользователя к Pravo.by и официальным порталам для проверки.\n\n"
        + "\n\n---\n\n".join(lines)
    )
    return deduped, block


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
