"""Проверки загружаемых файлов (сканер, КУДиР): имя, соответствие содержимого заявленному типу."""

from __future__ import annotations

import re


def sanitize_upload_filename(name: str | None, default: str = "upload") -> str:
    """Убираем путь, управляющие символы и чрезмерную длину — безопасное имя для логов и БД."""
    raw = (name or "").replace("\\", "/").split("/")[-1] or default
    cleaned = re.sub(r'[^\w.\- \(\)\[\]А-Яа-яЁёІіЎў]+', "_", raw, flags=re.UNICODE)
    cleaned = cleaned.strip(". ")[:180] or default
    return cleaned


def bytes_match_declared_type(content: bytes, effective_type: str) -> bool:
    """Минимальная проверка сигнатуры; снижает риск подмены типа по заголовку или расширению."""
    if effective_type == "image/jpeg":
        return len(content) >= 3 and content[:3] == b"\xff\xd8\xff"
    if effective_type == "application/pdf":
        return len(content) >= 4 and content[:4] == b"%PDF"
    if effective_type == "image/png":
        return len(content) >= 8 and content[:8] == b"\x89PNG\r\n\x1a\n"
    if effective_type == "image/webp":
        return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    if effective_type == "image/heic":
        if len(content) < 16 or content[4:8] != b"ftyp":
            return False
        brand = content[8:16]
        return b"heic" in brand or b"mif1" in brand or b"msf1" in brand
    return False
