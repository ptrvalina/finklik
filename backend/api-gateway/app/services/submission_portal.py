"""Интеграция с «порталом» органа: мок в приложении или HTTP-адаптер."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import structlog

from app.core.config import Settings

log = structlog.get_logger()


@dataclass
class HttpPortalResult:
    accepted: bool
    portal_reference: str | None = None
    reason: str | None = None


def parse_portal_response_json(data: dict[str, Any]) -> HttpPortalResult:
    """Ожидаемый JSON от HTTP-адаптера: accepted, опционально portal_reference / reason."""
    if "accepted" in data:
        accepted = bool(data["accepted"])
    else:
        accepted = bool(data.get("ok", False))
    return HttpPortalResult(
        accepted=accepted,
        portal_reference=data.get("portal_reference") or data.get("reference"),
        reason=data.get("reason") or data.get("rejection_reason"),
    )


async def submit_to_http_portal(
    settings: Settings,
    *,
    submission_id: str,
    organization_id: str,
    authority: str,
    report_type: str,
    report_period: str,
    local_reference: str,
    report_data: Any,
) -> HttpPortalResult:
    """
    POST {SUBMISSION_PORTAL_BASE_URL}/submit с телом заявки.
    Успешный ответ 2xx: JSON с полем accepted (bool).
    Контракт см. docs/dev/DEVELOPER_GUIDE.md (раздел про портал подачи).
    """
    import httpx

    base = settings.SUBMISSION_PORTAL_BASE_URL.strip().rstrip("/")
    url = f"{base}/submit"
    payload = {
        "submission_id": submission_id,
        "organization_id": organization_id,
        "authority": authority,
        "report_type": report_type,
        "report_period": report_period,
        "local_reference": local_reference,
        "report_data": report_data,
    }
    timeout = httpx.Timeout(settings.SUBMISSION_PORTAL_HTTP_TIMEOUT_SEC)
    attempts = max(1, int(settings.SUBMISSION_PORTAL_HTTP_RETRIES) + 1)
    last_error: BaseException | None = None

    for attempt in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, json=payload)
                if 200 <= resp.status_code < 300:
                    body = resp.json()
                    return parse_portal_response_json(body)
                if resp.status_code >= 500:
                    last_error = RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
                    log.warning("submission_portal.http_5xx", attempt=attempt, status=resp.status_code)
                    await asyncio.sleep(0.25 * (attempt + 1))
                    continue
                try:
                    body = resp.json()
                    result = parse_portal_response_json(body)
                    if not result.accepted and not result.reason:
                        result = HttpPortalResult(
                            accepted=False,
                            reason=resp.text[:500] if resp.text else f"HTTP {resp.status_code}",
                        )
                    return result
                except Exception:
                    return HttpPortalResult(
                        accepted=False,
                        reason=(resp.text[:500] if resp.text else f"HTTP {resp.status_code}"),
                    )
        except Exception as exc:
            last_error = exc
            log.warning("submission_portal.http_error", attempt=attempt, error=str(exc))
            await asyncio.sleep(0.25 * (attempt + 1))

    assert last_error is not None
    raise last_error
