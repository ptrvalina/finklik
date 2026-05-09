"""Фасад подготовки данных к ЭЦП без привязки к конкретному криптопровайдеру.

Реальное подписание (PKCS#11, Avest, удалённая подпись) выполняется вне API — здесь только
канонизация полезной нагрузки и SHA-256 для передачи во внешний модуль подписи.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any


def canonical_json_bytes(payload: Any) -> bytes:
    """Детерминированная сериализация JSON (UTF-8, без лишних пробелов)."""
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


@dataclass(frozen=True)
class SigningDigest:
    sha256_hex: str
    canonical_length: int
    algorithm: str = "SHA-256"


def compute_digest(payload: Any) -> SigningDigest:
    raw = canonical_json_bytes(payload)
    h = hashlib.sha256(raw).hexdigest()
    return SigningDigest(sha256_hex=h, canonical_length=len(raw), algorithm="SHA-256")


def mock_signature_b64_preview(digest_hex: str) -> str:
    """Демонстрационная «подпись» для UI/тестов (не юридически значима)."""
    import base64

    marker = f"MOCK-CMS:{digest_hex}".encode("ascii")
    return base64.standard_b64encode(marker).decode("ascii")
