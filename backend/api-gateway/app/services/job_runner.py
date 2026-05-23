"""Обёртка фоновых задач: retry, backoff, метрики."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

import structlog

from app.security.metrics import JOB_DEAD_LETTER_TOTAL, JOB_FAILED_TOTAL, JOB_RETRY_TOTAL, JOB_SUCCESS_TOTAL

log = structlog.get_logger()
T = TypeVar("T")


async def run_with_retry(
    job_name: str,
    fn: Callable[[], Awaitable[T]],
    *,
    max_attempts: int = 3,
    base_delay_sec: float = 2.0,
    timeout_sec: float | None = 300.0,
) -> T | None:
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            if timeout_sec:
                result = await asyncio.wait_for(fn(), timeout=timeout_sec)
            else:
                result = await fn()
            JOB_SUCCESS_TOTAL.labels(job=job_name).inc()
            return result
        except asyncio.TimeoutError as exc:
            last_exc = exc
            JOB_FAILED_TOTAL.labels(job=job_name, reason="timeout").inc()
            log.warning("job_timeout", job=job_name, attempt=attempt)
        except Exception as exc:
            last_exc = exc
            JOB_FAILED_TOTAL.labels(job=job_name, reason=type(exc).__name__).inc()
            log.warning("job_failed", job=job_name, attempt=attempt, error=str(exc))
        if attempt < max_attempts:
            JOB_RETRY_TOTAL.labels(job=job_name).inc()
            await asyncio.sleep(base_delay_sec * (2 ** (attempt - 1)))
    JOB_DEAD_LETTER_TOTAL.labels(job=job_name).inc()
    log.error("job_dead_letter", job=job_name, error=str(last_exc))
    return None
