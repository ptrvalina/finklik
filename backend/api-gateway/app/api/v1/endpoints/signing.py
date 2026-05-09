"""Подготовка дайджеста для внешней ЭЦП (провайдер подключается снаружи API)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings
from app.core.deps import get_current_user, require_roles
from app.models.regulatory import ReportSubmission
from app.models.user import User
from app.services.signing_facade import compute_digest, mock_signature_b64_preview

router = APIRouter(
    prefix="/signing",
    tags=["signing"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


@router.get("/submissions/{submission_id}/digest")
async def submission_payload_digest(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SHA-256 канонического JSON черновика отчёта для подписания на стороне клиента/АРМ."""
    result = await db.execute(
        select(ReportSubmission).where(
            ReportSubmission.id == submission_id,
            ReportSubmission.organization_id == current_user.organization_id,
        )
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if not submission.report_data_json:
        raise HTTPException(status_code=400, detail="Нет данных отчёта для подписи")

    try:
        payload = json.loads(submission.report_data_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Некорректный JSON отчёта: {exc}") from exc

    envelope = {
        "submission_id": submission.id,
        "authority": submission.authority,
        "report_type": submission.report_type,
        "report_period": submission.report_period,
        "status": submission.status,
        "report_data": payload,
    }
    digest = compute_digest(envelope)
    settings = get_settings()
    mock_sig = None
    if getattr(settings, "SIGNING_INCLUDE_MOCK_SIGNATURE", False):
        mock_sig = mock_signature_b64_preview(digest.sha256_hex)

    return {
        "submission_id": submission.id,
        "algorithm": digest.algorithm,
        "sha256_hex": digest.sha256_hex,
        "canonical_json_length": digest.canonical_length,
        "mock_signature_base64": mock_sig,
        "hint": (
            "Передайте sha256_hex или канонический JSON во внешний модуль ЭЦП организации. "
            "ФинКлик не хранит ключи подписи."
        ),
    }
