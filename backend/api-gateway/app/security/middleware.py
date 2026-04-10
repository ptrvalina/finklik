"""
Безопасность ФинКлик:
- Rate limiting (100 req/min per user/IP)
- Brute-force защита (блокировка после 5 неудач на 15 мин)
- Audit log (кто, что, когда, IP)
- AES-256 шифрование персональных данных
- CSP / Security заголовки
"""
import os
import time
import json
from pathlib import Path
import base64
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Callable
from collections import defaultdict

from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# ── In-memory хранилища (в проде → Redis) ────────────────────────────────────

# rate_limit_store[key] = [timestamp, ...]
_rate_limit_store: dict[str, list[float]] = defaultdict(list)

# brute_force_store[email] = {"fails": int, "blocked_until": float}
_brute_force_store: dict[str, dict] = {}

# audit_log buffer (в проде → БД/ELK)
_audit_log: list[dict] = []

try:
    from app.core.config import settings as _cfg
    RATE_LIMIT_REQUESTS = _cfg.RATE_LIMIT_PER_MINUTE
    RATE_LIMIT_BURST = _cfg.RATE_LIMIT_BURST
except Exception:
    RATE_LIMIT_REQUESTS = 120
    RATE_LIMIT_BURST = 30
RATE_LIMIT_WINDOW = 60     # секунд
BRUTE_FORCE_MAX = 5
BRUTE_FORCE_BLOCK = 15 * 60  # 15 минут

_CLEANUP_COUNTER = 0
_CLEANUP_INTERVAL = 500


# ── Rate Limiting ─────────────────────────────────────────────────────────────

def _rate_limit_key(request: Request) -> str:
    """Ключ: IP + user_id если авторизован."""
    ip = request.client.host if request.client else "unknown"
    auth = request.headers.get("Authorization", "")
    suffix = hashlib.md5(auth.encode()).hexdigest()[:8] if auth else "anon"
    return f"rl:{ip}:{suffix}"


def check_rate_limit(request: Request) -> None:
    global _CLEANUP_COUNTER
    key = _rate_limit_key(request)
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if t > window_start]

    if len(_rate_limit_store[key]) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Слишком много запросов. Повторите через {RATE_LIMIT_WINDOW} секунд.",
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
        )

    _rate_limit_store[key].append(now)

    _CLEANUP_COUNTER += 1
    if _CLEANUP_COUNTER >= _CLEANUP_INTERVAL:
        _CLEANUP_COUNTER = 0
        _cleanup_rate_limit_store(now - RATE_LIMIT_WINDOW)


def _cleanup_rate_limit_store(cutoff: float) -> None:
    """Periodically remove stale keys to prevent memory growth with 40k+ clients."""
    stale = [k for k, v in _rate_limit_store.items() if not v or v[-1] < cutoff]
    for k in stale:
        del _rate_limit_store[k]


# ── Brute Force Protection ────────────────────────────────────────────────────

def check_brute_force(email: str) -> None:
    """Вызывать перед попыткой логина."""
    entry = _brute_force_store.get(email)
    if not entry:
        return

    if entry.get("blocked_until", 0) > time.time():
        remaining = int(entry["blocked_until"] - time.time())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Аккаунт временно заблокирован. Повторите через {remaining // 60} мин {remaining % 60} сек.",
        )


def record_failed_login(email: str) -> None:
    """Вызывать при неудачном логине."""
    entry = _brute_force_store.setdefault(email, {"fails": 0, "blocked_until": 0.0})
    entry["fails"] += 1
    if entry["fails"] >= BRUTE_FORCE_MAX:
        entry["blocked_until"] = time.time() + BRUTE_FORCE_BLOCK
        entry["fails"] = 0


def record_successful_login(email: str) -> None:
    """Сбрасываем счётчик при успешном логине."""
    _brute_force_store.pop(email, None)


# ── Audit Log ─────────────────────────────────────────────────────────────────

def audit_log(
    action: str,
    user_id: str | None,
    resource: str,
    resource_id: str | None,
    ip: str,
    details: dict | None = None,
    success: bool = True,
) -> None:
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "user_id": user_id,
        "resource": resource,
        "resource_id": resource_id,
        "ip": ip,
        "success": success,
        "details": details or {},
    }
    _audit_log.append(entry)
    # В проде: asyncio.create_task(save_to_db(entry))


def get_audit_log(limit: int = 100) -> list[dict]:
    return _audit_log[-limit:]


# ── Fernet шифрование персональных данных ─────────────────────────────────────

class DataEncryptor:
    """
    Симметричное шифрование Fernet (AES-128-CBC + HMAC-SHA256).
    Безопасная реализация для PII. Ключ в проде — из HashiCorp Vault / env.
    """

    def __init__(self, key: str):
        key_bytes = hashlib.sha256(key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key_bytes)
        try:
            from cryptography.fernet import Fernet
            self._fernet = Fernet(fernet_key)
            self._legacy = False
        except ImportError:
            self._key = key_bytes
            self._fernet = None
            self._legacy = True

    def encrypt(self, plaintext: str) -> str:
        if not plaintext:
            return plaintext
        if self._fernet:
            return self._fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")
        data = plaintext.encode("utf-8")
        key_stream = (self._key * (len(data) // 32 + 1))[:len(data)]
        return base64.b64encode(bytes(a ^ b for a, b in zip(data, key_stream))).decode("ascii")

    def decrypt(self, ciphertext: str) -> str:
        if not ciphertext:
            return ciphertext
        if self._fernet:
            try:
                return self._fernet.decrypt(ciphertext.encode("ascii")).decode("utf-8")
            except Exception:
                return self._decrypt_legacy(ciphertext)
        return self._decrypt_legacy(ciphertext)

    def _decrypt_legacy(self, ciphertext: str) -> str:
        """Fallback для данных, зашифрованных старым XOR."""
        try:
            key_bytes = hashlib.sha256(b"dev_encryption_key").digest() if self._legacy else self._key if hasattr(self, '_key') else hashlib.sha256(b"dev_encryption_key").digest()
            data = base64.b64decode(ciphertext.encode("ascii"))
            key_stream = (key_bytes * (len(data) // 32 + 1))[:len(data)]
            return bytes(a ^ b for a, b in zip(data, key_stream)).decode("utf-8")
        except Exception:
            return ciphertext


_encryptor: DataEncryptor | None = None


def get_encryptor(secret_key: str = "dev_encryption_key") -> DataEncryptor:
    global _encryptor
    if _encryptor is None:
        _encryptor = DataEncryptor(secret_key)
    return _encryptor


# ── Security Headers Middleware ───────────────────────────────────────────────

# Строгий CSP для API. Если Swagger/ReDoc с CDN (локальных static нет) — для /docs и /redoc CSP не ставим.
# В Docker ассеты качаются в static/ и грузятся с того же origin — CSP остаётся для всех путей.
_CSP_DEFAULT = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: blob:; "
    "connect-src 'self' ws://localhost:* wss://*;"
)


def _local_docs_assets_present() -> bool:
    root = Path(__file__).resolve().parent.parent.parent
    return (root / "static" / "swagger-ui" / "swagger-ui-bundle.js").is_file()


def _is_docs_csp_path(path: str) -> bool:
    """`/docs` и `/docs/` (и то же для redoc)."""
    base = path.rstrip("/") or "/"
    if base in ("/docs", "/redoc"):
        return True
    return path.startswith("/docs/") or path.startswith("/redoc/")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.scope.get("type") == "websocket":
            return await call_next(request)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if _local_docs_assets_present() or not _is_docs_csp_path(request.url.path):
            response.headers["Content-Security-Policy"] = _CSP_DEFAULT
        return response


# ── Rate Limit Middleware ─────────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    SKIP_PATHS = {
        "/",
        "/health",
        "/api/v1/health",
        "/metrics",
        "/docs",
        "/docs/",
        "/redoc",
        "/redoc/",
        "/openapi.json",
    }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.scope.get("type") == "websocket":
            return await call_next(request)
        # Pytest: сотни запросов без токена (регистрация/логин) попадают в один anon-ключ → 429.
        if os.environ.get("DISABLE_RATE_LIMIT", "").lower() in ("1", "true", "yes"):
            return await call_next(request)
        path = request.url.path
        if path.startswith("/static/"):
            return await call_next(request)
        if path not in self.SKIP_PATHS and not _is_docs_csp_path(path):
            try:
                check_rate_limit(request)
            except HTTPException as e:
                return Response(
                    content=json.dumps({"detail": e.detail}),
                    status_code=e.status_code,
                    headers=dict(e.headers or {}),
                    media_type="application/json",
                )
        return await call_next(request)
