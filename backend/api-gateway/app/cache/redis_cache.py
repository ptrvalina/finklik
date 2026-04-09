"""
Redis кэш-сервис для ФинКлик.
TTL стратегия:
  - Контрагенты по УНП:   3600 сек (1 час)
  - Баланс банка:          60 сек  (1 мин — часто меняется)
  - Метрики дашборда:      300 сек (5 мин)
  - Курсы валют:          86400 сек (1 день)
  - Результаты OCR:       3600 сек (1 час — один и тот же файл)
"""
import json
import hashlib
from typing import Any
from functools import wraps

try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from app.core.config import settings


class CacheService:
    def __init__(self):
        self._client = None

    async def get_client(self):
        if not REDIS_AVAILABLE:
            return None
        if self._client is None:
            try:
                self._client = aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                await self._client.ping()
            except Exception:
                self._client = None
        return self._client

    async def get(self, key: str) -> Any | None:
        client = await self.get_client()
        if not client:
            return None
        try:
            val = await client.get(key)
            return json.loads(val) if val else None
        except Exception:
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        client = await self.get_client()
        if not client:
            return False
        try:
            await client.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception:
            return False

    async def delete(self, key: str) -> bool:
        client = await self.get_client()
        if not client:
            return False
        try:
            await client.delete(key)
            return True
        except Exception:
            return False

    async def delete_pattern(self, pattern: str) -> int:
        client = await self.get_client()
        if not client:
            return 0
        try:
            keys = await client.keys(pattern)
            if keys:
                return await client.delete(*keys)
            return 0
        except Exception:
            return 0

    # ── Готовые ключи ──────────────────────────────────────────────────

    def key_dashboard(self, org_id: str) -> str:
        return f"dashboard:{org_id}"

    def key_counterparty(self, unp: str) -> str:
        return f"counterparty:unp:{unp}"

    def key_bank_balance(self, org_id: str) -> str:
        return f"bank:balance:{org_id}"

    def key_ocr_result(self, file_hash: str) -> str:
        return f"ocr:result:{file_hash}"

    def file_hash(self, content: bytes) -> str:
        return hashlib.md5(content).hexdigest()

    # ── Инвалидация по событиям ────────────────────────────────────────

    async def invalidate_org(self, org_id: str):
        """Сброс всего кэша организации при изменении данных."""
        await self.delete(self.key_dashboard(org_id))
        await self.delete(self.key_bank_balance(org_id))


cache = CacheService()
