"""AES-256-GCM helpers for sensitive fields."""

from __future__ import annotations

import base64
import os
from functools import lru_cache

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


class AesGcmEncryptor:
    """Encrypts/decrypts UTF-8 strings using AES-256-GCM."""

    def __init__(self, key: bytes):
        if len(key) != 32:
            raise ValueError("AES-256-GCM key must be 32 bytes")
        self._aes = AESGCM(key)

    def encrypt(self, value: str | None) -> str | None:
        """Encrypt a string and return urlsafe-base64 nonce+ciphertext."""
        if not value:
            return value
        nonce = os.urandom(12)
        cipher = self._aes.encrypt(nonce, value.encode("utf-8"), None)
        payload = nonce + cipher
        return base64.urlsafe_b64encode(payload).decode("ascii")

    def decrypt(self, value: str | None) -> str | None:
        """Decrypt a urlsafe-base64 nonce+ciphertext payload."""
        if not value:
            return value
        raw = base64.urlsafe_b64decode(value.encode("ascii"))
        nonce, cipher = raw[:12], raw[12:]
        plain = self._aes.decrypt(nonce, cipher, None)
        return plain.decode("utf-8")


@lru_cache(maxsize=1)
def get_aes_gcm_encryptor() -> AesGcmEncryptor:
    """Build cached AES-256-GCM encryptor from app secret."""
    secret = settings.JWT_SECRET_KEY.encode("utf-8")
    key = secret[:32].ljust(32, b"0")
    return AesGcmEncryptor(key)
