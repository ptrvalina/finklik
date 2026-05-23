"""ЭЦП Model A: хэш на сервере, подпись на клиенте; проверка и доменное событие DocumentSigned."""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings
from app.core.datetime_utils import utc_now_naive
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.events.emit import emit_document_signed
from app.models.regulatory import ReportSubmission
from app.models.signing_request import SigningRequest, SigningSession
from app.models.user import User
from app.services.signing_document_envelope import build_document_signing_envelope
from app.services.signing_facade import compute_digest, mock_signature_b64_preview
from app.services.signature_providers import default_provider
from app.services.signature_verification import verify_signature_against_hash

router = APIRouter(
    prefix="/signing",
    tags=["signing"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)

DocumentKind = Literal["primary_document", "scanned_document", "report_submission"]


class SigningRequestCreate(BaseModel):
    document_id: str = Field(..., min_length=1, max_length=64)
    document_kind: DocumentKind
    client_metadata: dict[str, Any] | None = None


class SigningCompleteBody(BaseModel):
    signing_request_id: str
    signature_base64: str = Field(..., min_length=4)
    certificate_pem: str | None = None
    certificate_metadata: dict[str, Any] | None = None


@router.get("/submissions/{submission_id}/digest")
async def submission_payload_digest(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SHA-256 канонического JSON черновика отчёта для подписания на стороне клиента/АРМ."""
    oid = workspace_organization_id(current_user)
    result = await db.execute(
        select(ReportSubmission).where(
            ReportSubmission.id == submission_id,
            ReportSubmission.organization_id == oid,
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
        "default_provider": default_provider(),
        "hint": (
            "Передайте sha256_hex или канонический JSON во внешний модуль ЭЦП организации. "
            "ФинКлик не хранит ключи подписи."
        ),
    }


@router.post("/request")
async def create_signing_request(
    body: SigningRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать запрос на подпись: возвращает document_hash и signing_request_id (ключ не покидает клиент)."""
    oid = workspace_organization_id(current_user)
    if not oid:
        raise HTTPException(status_code=400, detail="Нет организации")

    envelope = await build_document_signing_envelope(
        db, organization_id=oid, document_kind=body.document_kind, document_id=body.document_id
    )
    digest = compute_digest(envelope)
    now = utc_now_naive()
    expires = now + timedelta(minutes=35)

    req = SigningRequest(
        organization_id=oid,
        user_id=str(current_user.id),
        document_kind=body.document_kind,
        document_id=body.document_id,
        document_hash=digest.sha256_hex,
        hash_algorithm=digest.algorithm,
        status="pending",
        created_at=now,
        expires_at=expires,
    )
    db.add(req)
    await db.flush()

    meta_json = json.dumps(body.client_metadata or {}, ensure_ascii=False) if body.client_metadata else None
    sess = SigningSession(request_id=req.id, client_metadata_json=meta_json, started_at=now)
    db.add(sess)

    settings = get_settings()
    mock_sig = None
    if getattr(settings, "SIGNING_INCLUDE_MOCK_SIGNATURE", False):
        mock_sig = mock_signature_b64_preview(digest.sha256_hex)

    return {
        "signing_request_id": req.id,
        "document_id": body.document_id,
        "document_kind": body.document_kind,
        "document_hash": digest.sha256_hex,
        "algorithm": digest.algorithm,
        "expires_at": expires.isoformat(),
        "mock_signature_base64": mock_sig,
        "default_provider": default_provider(),
    }


@router.post("/complete")
async def complete_signing_request(
    body: SigningCompleteBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Принять подпись с клиента, проверить целостность и зафиксировать DocumentSigned."""
    oid = workspace_organization_id(current_user)
    if not oid:
        raise HTTPException(status_code=400, detail="Нет организации")

    r = await db.execute(
        select(SigningRequest).where(
            SigningRequest.id == body.signing_request_id,
            SigningRequest.organization_id == oid,
            SigningRequest.user_id == str(current_user.id),
        )
    )
    req = r.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Запрос на подпись не найден")

    now = utc_now_naive()
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="Запрос уже обработан")
    if req.expires_at < now:
        req.status = "expired"
        await db.flush()
        raise HTTPException(status_code=410, detail="Срок запроса истёк")

    ok, reason = verify_signature_against_hash(
        document_hash_hex=req.document_hash,
        signature_b64=body.signature_base64,
        certificate_pem=body.certificate_pem,
    )
    if not ok:
        req.status = "rejected"
        req.rejection_reason = reason or "verification_failed"
        await db.flush()
        raise HTTPException(
            status_code=400,
            detail=reason or "signature_invalid",
        )

    req.status = "signed"
    req.signature_b64 = body.signature_base64
    req.certificate_pem = body.certificate_pem
    req.certificate_metadata_json = (
        json.dumps(body.certificate_metadata, ensure_ascii=False) if body.certificate_metadata else None
    )
    req.signed_at = now

    sess_r = await db.execute(
        select(SigningSession).where(SigningSession.request_id == req.id).order_by(desc(SigningSession.started_at)).limit(1)
    )
    sess = sess_r.scalars().first()
    if sess:
        sess.completed_at = now

    await emit_document_signed(
        db,
        oid,
        signing_request_id=req.id,
        document_kind=req.document_kind,
        document_id=req.document_id,
        document_hash=req.document_hash,
        hash_algorithm=req.hash_algorithm,
        actor="user",
    )
    await db.flush()

    return {
        "signing_request_id": req.id,
        "signed_document_id": req.document_id,
        "document_kind": req.document_kind,
        "status": req.status,
        "audit_event": "DocumentSigned",
    }


@router.get("/status/{signing_request_id}")
async def signing_request_status(
    signing_request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = workspace_organization_id(current_user)
    if not oid:
        raise HTTPException(status_code=400, detail="Нет организации")

    r = await db.execute(
        select(SigningRequest).where(
            SigningRequest.id == signing_request_id,
            SigningRequest.organization_id == oid,
            SigningRequest.user_id == str(current_user.id),
        )
    )
    req = r.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")

    return {
        "id": req.id,
        "status": req.status,
        "document_kind": req.document_kind,
        "document_id": req.document_id,
        "document_hash": req.document_hash,
        "hash_algorithm": req.hash_algorithm,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "expires_at": req.expires_at.isoformat() if req.expires_at else None,
        "signed_at": req.signed_at.isoformat() if req.signed_at else None,
        "rejection_reason": req.rejection_reason,
        "default_provider": default_provider(),
    }
