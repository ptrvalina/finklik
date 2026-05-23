from datetime import datetime, timedelta, timezone
from typing import Any
import binascii
import uuid

import bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from app.core.config import settings

# Use PBKDF2 for new passwords to avoid passlib+bcrypt backend issues on newer
# Python/bcrypt builds, while keeping backward compatibility for existing
# bcrypt hashes via explicit fallback in verify_password().
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    if hashed.startswith("$2"):
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
        except (ValueError, TypeError, binascii.Error):
            return False
    return pwd_context.verify(plain, hashed)


def _create_token(data: dict[str, Any], secret: str, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, secret, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, org_id: str, role: str) -> str:
    return _create_token(
        {"sub": user_id, "org_id": org_id, "role": role, "type": "access"},
        settings.JWT_SECRET_KEY,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token_pair(user_id: str) -> tuple[str, str]:
    """Пара (token, jti) для ротации refresh и обнаружения повторного использования."""
    jti = str(uuid.uuid4())
    token = _create_token(
        {"sub": user_id, "type": "refresh", "jti": jti},
        settings.JWT_REFRESH_SECRET_KEY,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return token, jti


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный тип токена")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен недействителен или истёк",
            headers={"WWW-Authenticate": "Bearer"},
        )


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Возвращает sub и jti (jti может быть None у старых токенов до ротации)."""
    try:
        payload = jwt.decode(token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный тип токена")
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный refresh токен")
        raw_jti = payload.get("jti")
        jti = str(raw_jti) if raw_jti else None
        return {"sub": str(sub), "jti": jti}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh токен недействителен")
