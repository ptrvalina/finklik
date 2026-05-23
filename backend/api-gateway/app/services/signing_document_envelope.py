"""Каноническая полезная нагрузка для хэша документа (подпись только на клиенте)."""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import PrimaryDocument, ScannedDocument
from app.models.regulatory import ReportSubmission


async def build_document_signing_envelope(
    db: AsyncSession,
    *,
    organization_id: str,
    document_kind: str,
    document_id: str,
) -> dict[str, Any]:
    if document_kind == "report_submission":
        r = await db.execute(
            select(ReportSubmission).where(
                ReportSubmission.id == document_id,
                ReportSubmission.organization_id == organization_id,
            )
        )
        sub = r.scalar_one_or_none()
        if not sub:
            raise HTTPException(status_code=404, detail="Отчёт не найден")
        if not sub.report_data_json:
            raise HTTPException(status_code=400, detail="Нет данных отчёта для подписи")
        try:
            payload = json.loads(sub.report_data_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Некорректный JSON отчёта: {exc}") from exc
        return {
            "kind": "report_submission",
            "submission_id": sub.id,
            "authority": sub.authority,
            "report_type": sub.report_type,
            "report_period": sub.report_period,
            "status": sub.status,
            "report_data": payload,
        }

    if document_kind == "primary_document":
        r = await db.execute(
            select(PrimaryDocument).where(
                PrimaryDocument.id == document_id,
                PrimaryDocument.organization_id == organization_id,
            )
        )
        doc = r.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Первичный документ не найден")
        return {
            "kind": "primary_document",
            "document_id": doc.id,
            "doc_type": doc.doc_type,
            "doc_number": doc.doc_number,
            "status": doc.status,
            "issue_date": doc.issue_date.isoformat() if doc.issue_date else None,
            "amount_total": str(doc.amount_total),
            "currency": doc.currency,
            "counterparty_id": doc.counterparty_id,
            "transaction_id": doc.transaction_id,
        }

    if document_kind == "scanned_document":
        r = await db.execute(
            select(ScannedDocument).where(
                ScannedDocument.id == document_id,
                ScannedDocument.organization_id == organization_id,
            )
        )
        sd = r.scalar_one_or_none()
        if not sd:
            raise HTTPException(status_code=404, detail="Скан не найден")
        return {
            "kind": "scanned_document",
            "document_id": sd.id,
            "filename": sd.filename,
            "doc_type": sd.doc_type,
            "status": sd.status,
            "lifecycle_status": sd.lifecycle_status,
            "confidence": sd.confidence,
            "transaction_id": sd.transaction_id,
            "parsed_data": sd.parsed_data,
            "ocr_text": (sd.ocr_text or "")[:4000],
        }

    raise HTTPException(status_code=400, detail="Неизвестный document_kind")
