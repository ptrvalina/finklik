"""Correlation ID для логов и трассировки запросов (без внешнего APM)."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = structlog.get_logger()


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Пробрасывает X-Request-ID (или генерирует), биндит в structlog contextvars."""

    HEADER = "X-Request-ID"

    async def dispatch(self, request: Request, call_next: Callable[[Request], Any]) -> Response:
        incoming = request.headers.get(self.HEADER)
        cid = (incoming or "").strip() or str(uuid.uuid4())
        if len(cid) > 128:
            cid = str(uuid.uuid4())
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(correlation_id=cid, path=request.url.path, method=request.method)
        request.state.correlation_id = cid
        try:
            response = await call_next(request)
            response.headers[self.HEADER] = cid
            return response
        finally:
            structlog.contextvars.clear_contextvars()
