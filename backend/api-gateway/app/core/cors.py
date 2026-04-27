"""CORS: разбор переменных окружения, проверка origins, сборка параметров middleware.

Инварианты безопасности:
- без `*` и без credential wildcard;
- только схемы http/https и origin без path/query/fragment (как в браузере);
- regex для preview-доменов компилируется при старте — некорректный паттерн не попадёт в рантайм.
"""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse

_ALLOWED_SCHEMES = frozenset({"http", "https"})


def normalize_origin_token(origin: str) -> str:
    return origin.strip().rstrip("/")


def validate_browser_origin(origin: str) -> str:
    """Проверка строки Origin в стиле браузера (scheme://host[:port])."""
    o = normalize_origin_token(origin)
    if not o:
        raise ValueError("Пустой CORS origin")
    if "*" in o:
        raise ValueError("Символ '*' в origin недопустим при использовании credentials")
    parsed = urlparse(o)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValueError(f"CORS origin должен быть http(s): {origin!r}")
    if not parsed.hostname:
        raise ValueError(f"CORS origin без хоста: {origin!r}")
    if "@" in parsed.netloc:
        raise ValueError("CORS origin не должен содержать userinfo (@)")
    if parsed.params or parsed.query or parsed.fragment:
        raise ValueError(f"CORS origin не должен содержать query/fragment: {origin!r}")
    # Браузер не присылает path в Origin, кроме как пустой; отсекаем случайные пути из .env
    path = parsed.path or ""
    if path not in ("", "/"):
        raise ValueError(f"CORS origin не должен содержать path (уберите {path!r}): {origin!r}")
    # Нормализуем к виду без завершающего слэша у «пути»
    netloc = parsed.netloc
    out = f"{parsed.scheme}://{netloc}"
    return out.rstrip("/")


def dedupe_preserve_order(origins: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in origins:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def parse_cors_origins_env(raw: str) -> list[str]:
    """Строка из env: JSON-массив или список через запятую."""
    s = raw.strip()
    if not s:
        return []
    if s.startswith("["):
        parsed = json.loads(s)
        if not isinstance(parsed, list):
            raise ValueError("CORS_ORIGINS в формате JSON должен быть массивом строк")
        items = [str(x).strip() for x in parsed if str(x).strip()]
    else:
        items = [x.strip() for x in s.split(",") if x.strip()]

    validated = [validate_browser_origin(x) for x in items]
    return dedupe_preserve_order(validated)


def compile_cors_origin_regex(pattern: str | None) -> str | None:
    """Возвращает паттерн или None; пустая строка или только пробелы = отключено."""
    p = (pattern or "").strip()
    if not p:
        return None
    try:
        re.compile(p)
    except re.error as exc:
        raise ValueError(f"Некорректный CORS_ORIGIN_REGEX: {exc}") from exc
    return p


def cors_middleware_kwargs(
    *,
    origins: list[str],
    origin_regex: str | None,
    allow_credentials: bool = True,
    max_age: int = 600,
) -> dict[str, Any]:
    """Единая точка сборки аргументов для starlette.middleware.cors.CORSMiddleware."""
    return {
        "allow_origins": list(origins),
        "allow_origin_regex": origin_regex,
        "allow_credentials": allow_credentials,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
        "max_age": max_age,
    }
