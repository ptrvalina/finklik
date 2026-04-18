"""Шифрование API-ключа ИИ организации (BYOK).

Ключ никогда не пишется в логи в открытом виде; в БД хранится только ciphertext (Fernet).
Расшифровка только в памяти на время запроса к провайдеру LLM.
Смена JWT_SECRET_KEY на сервере делает ранее сохранённые ключи нечитаемыми — владельцам нужно ввести ключ заново.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_DERIVE_SALT = b"finklik-org-llm-credential-v1"
_DERIVE_ITER = 480_000


def _fernet() -> Fernet:
    raw = hashlib.pbkdf2_hmac(
        "sha256",
        (settings.JWT_SECRET_KEY or "").encode("utf-8"),
        _DERIVE_SALT,
        _DERIVE_ITER,
        dklen=32,
    )
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_org_llm_api_key(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.strip().encode("utf-8")).decode("ascii")


def decrypt_org_llm_api_key(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.strip().encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as e:
        raise ValueError("Не удалось расшифровать сохранённый ключ ИИ") from e
