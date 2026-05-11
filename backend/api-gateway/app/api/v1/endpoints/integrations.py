"""Сводка по внешним контурам (госAPI, портал подачи, курсы НБ РБ) — без секретов."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.deps import get_current_user, workspace_organization_id
from app.models.user import User
from app.services import nbrb_fx_service

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/capabilities")
async def integration_capabilities(current_user: User = Depends(get_current_user)):
    """Какие режимы интеграции активны для развёртывания (диагностика и UI «Настройки»)."""
    settings = get_settings()
    snap = nbrb_fx_service.get_snapshot()
    nbrb_meta: dict = {
        "mode": "live_http",
        "enabled": settings.NBRB_FX_ENABLED,
        "refresh_seconds": settings.NBRB_FX_REFRESH_SECONDS,
    }
    if snap:
        nbrb_meta["last_fetch_at"] = snap.fetched_at.isoformat()
        nbrb_meta["rates_date"] = snap.rates_date.isoformat()
        nbrb_meta["stale_error"] = snap.error
        nbrb_meta["currencies_count"] = len(snap.currencies)
    else:
        nbrb_meta["last_fetch_at"] = None
        nbrb_meta["note"] = "Снимок курсов ещё не загружен (холодный старт или отключено)."

    authorities = [
        {
            "code": "imns",
            "label": "ИМНС",
            "submission_adapter": "http" if settings.SUBMISSION_PORTAL_MODE == "http" else "mock",
            "direct_api": "stub",
            "detail": "Прямой API ИМНС не подключён — используйте HTTP-адаптер портала или mock.",
        },
        {
            "code": "fsszn",
            "label": "ФСЗН",
            "submission_adapter": "http" if settings.SUBMISSION_PORTAL_MODE == "http" else "mock",
            "direct_api": "stub",
            "detail": "Прямой API ФСЗН не подключён.",
        },
        {
            "code": "belgosstrakh",
            "label": "Белгосстрах",
            "submission_adapter": "http" if settings.SUBMISSION_PORTAL_MODE == "http" else "mock",
            "direct_api": "stub",
            "detail": "Прямой API не подключён.",
        },
        {
            "code": "belstat",
            "label": "Белстат",
            "submission_adapter": "http" if settings.SUBMISSION_PORTAL_MODE == "http" else "mock",
            "direct_api": "stub",
            "detail": "Прямой API не подключён.",
        },
    ]

    return {
        "queried_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": workspace_organization_id(current_user),
        "submission_portal": {
            "mode": settings.SUBMISSION_PORTAL_MODE,
            "base_url_configured": bool(settings.SUBMISSION_PORTAL_BASE_URL.strip()),
            "async_submit_enabled": settings.SUBMISSION_ASYNC,
            "http_timeout_sec": settings.SUBMISSION_PORTAL_HTTP_TIMEOUT_SEC,
        },
        "signing": {
            "digest_endpoint": "/api/v1/signing/submissions/{submission_id}/digest",
            "mock_signature_in_digest": settings.SIGNING_INCLUDE_MOCK_SIGNATURE,
        },
        "nbrb_fx": nbrb_meta,
        "authorities": authorities,
    }
