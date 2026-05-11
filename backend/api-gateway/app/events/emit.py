"""Dual-write: после успешного CRUD добавляем запись в EventStore (логика сохранения не меняется)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


def _json_safe(obj: Any) -> Any:
    """Убирает Decimal и прочие типы, не сериализуемые в JSON."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {str(k): _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(x) for x in obj]
    return obj

from app.events.bootstrap import get_event_store
from app.events.constants import (
    EV_AI_SUGGESTION_RECORDED,
    EV_APPROVAL_COMPLETED,
    EV_APPROVAL_REQUESTED,
    EV_COMMENT_ADDED,
    EV_DOCUMENT_REQUESTED,
    EV_DOCUMENT_OCR_PROCESSED,
    EV_OBLIGATION_CREATED,
    EV_OCR_LINKED,
    EV_ORGANIZATION_SWITCHED,
    EV_RECONCILIATION_CONFIRMED,
    EV_RECONCILIATION_MATCH_RECORDED,
    EV_REPORT_GENERATED,
    EV_REPORT_PREPARATION_STARTED,
    EV_REPORT_VALIDATED,
    EV_SUBMISSION_COMPLETED,
    EV_TRANSACTION_CREATED,
    EV_TRANSACTION_CATEGORIZED,
    EV_TRANSACTION_DELETED,
    EV_TRANSACTION_UPDATED,
)
from app.models.transaction import Transaction


def _dec_str(v: Decimal | None) -> str | None:
    if v is None:
        return None
    return str(v)


async def emit_transaction_created(
    db: AsyncSession,
    organization_id: str,
    tx: Transaction,
    *,
    actor: str = "user",
) -> None:
    store = get_event_store()
    payload: dict[str, Any] = {
        "transaction_type": tx.type,
        "amount": _dec_str(tx.amount),
        "vat_amount": _dec_str(tx.vat_amount),
        "currency": tx.currency,
        "category": tx.category,
        "description": tx.description,
        "source": tx.source,
        "status": tx.status,
        "transaction_date": tx.transaction_date.isoformat() if tx.transaction_date else None,
        "counterparty_id": tx.counterparty_id,
        "cost_center_id": tx.cost_center_id,
        "revenue_stream_id": tx.revenue_stream_id,
    }
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_TRANSACTION_CREATED,
        actor=actor,
        target_id=tx.id,
        target_kind="transaction",
        payload=payload,
        idempotency_key=f"{organization_id}:ev:{EV_TRANSACTION_CREATED}:{tx.id}",
    )


async def emit_transaction_updated(
    db: AsyncSession,
    organization_id: str,
    tx: Transaction,
    *,
    actor: str = "user",
) -> None:
    store = get_event_store()
    payload: dict[str, Any] = {
        "transaction_type": tx.type,
        "amount": _dec_str(tx.amount),
        "category": tx.category,
        "description": tx.description,
        "status": tx.status,
        "transaction_date": tx.transaction_date.isoformat() if tx.transaction_date else None,
        "counterparty_id": tx.counterparty_id,
        "cost_center_id": tx.cost_center_id,
        "revenue_stream_id": tx.revenue_stream_id,
    }
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_TRANSACTION_UPDATED,
        actor=actor,
        target_id=tx.id,
        target_kind="transaction",
        payload=payload,
    )


async def emit_transaction_deleted(
    db: AsyncSession,
    organization_id: str,
    tx_id: str,
    *,
    snapshot: dict[str, Any],
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_TRANSACTION_DELETED,
        actor=actor,
        target_id=tx_id,
        target_kind="transaction",
        payload={"snapshot": snapshot},
        idempotency_key=f"{organization_id}:ev:{EV_TRANSACTION_DELETED}:{tx_id}",
    )


async def emit_document_ocr_processed(
    db: AsyncSession,
    organization_id: str,
    document_id: str,
    *,
    parsed: dict[str, Any],
    doc_type: str,
    confidence: int,
    linked_transaction_id: str | None,
    lifecycle_status: str | None = None,
    actor: str = "system",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_DOCUMENT_OCR_PROCESSED,
        actor=actor,
        target_id=document_id,
        target_kind="document",
        payload={
            "parsed": _json_safe(parsed),
            "doc_type": doc_type,
            "confidence": confidence,
            "linked_transaction_id": linked_transaction_id,
            "lifecycle_status": lifecycle_status,
        },
        idempotency_key=f"{organization_id}:ev:{EV_DOCUMENT_OCR_PROCESSED}:{document_id}",
    )


async def emit_reconciliation_match_recorded(
    db: AsyncSession,
    organization_id: str,
    match_id: str,
    *,
    transaction_id: str,
    document_id: str,
    confidence: float,
    status: str,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_RECONCILIATION_MATCH_RECORDED,
        actor=actor,
        target_id=match_id,
        target_kind="reconciliation_match",
        payload={
            "transaction_id": transaction_id,
            "document_id": document_id,
            "confidence": confidence,
            "status": status,
        },
        idempotency_key=f"{organization_id}:ev:{EV_RECONCILIATION_MATCH_RECORDED}:{match_id}",
    )


async def emit_transaction_categorized(
    db: AsyncSession,
    organization_id: str,
    transaction_id: str,
    *,
    previous_category: str | None,
    new_category: str | None,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_TRANSACTION_CATEGORIZED,
        actor=actor,
        target_id=transaction_id,
        target_kind="transaction",
        payload={
            "previous_category": previous_category,
            "new_category": new_category,
        },
    )


async def emit_ocr_linked(
    db: AsyncSession,
    organization_id: str,
    document_id: str,
    *,
    transaction_id: str,
    actor: str = "system",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_OCR_LINKED,
        actor=actor,
        target_id=document_id,
        target_kind="document",
        payload={"transaction_id": transaction_id},
    )


async def emit_reconciliation_confirmed(
    db: AsyncSession,
    organization_id: str,
    match_id: str,
    *,
    transaction_id: str,
    document_id: str,
    confidence: float,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_RECONCILIATION_CONFIRMED,
        actor=actor,
        target_id=match_id,
        target_kind="reconciliation_match",
        payload={
            "transaction_id": transaction_id,
            "document_id": document_id,
            "confidence": confidence,
        },
    )


async def emit_ai_suggestion_recorded(
    db: AsyncSession,
    organization_id: str,
    transaction_id: str,
    *,
    analysis: dict[str, Any],
    actor: str = "ai",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_AI_SUGGESTION_RECORDED,
        actor=actor,
        target_id=transaction_id,
        target_kind="transaction",
        payload={"kind": "AISuggestion", **analysis},
    )


async def emit_report_preparation_started(
    db: AsyncSession,
    organization_id: str,
    *,
    period: str | None = None,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_REPORT_PREPARATION_STARTED,
        actor=actor,
        target_id=str(organization_id),
        target_kind="organization",
        payload={"period": period},
    )


async def emit_report_validated(
    db: AsyncSession,
    organization_id: str,
    *,
    readiness_score: int,
    confidence: str,
    issue_count: int,
    actor: str = "system",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_REPORT_VALIDATED,
        actor=actor,
        target_id=str(organization_id),
        target_kind="organization",
        payload={
            "readiness_score": readiness_score,
            "confidence": confidence,
            "issue_count": issue_count,
        },
    )


async def emit_obligation_created(
    db: AsyncSession,
    organization_id: str,
    obligation_id: str,
    *,
    obligation_type: str,
    amount: Any,
    due_date: str,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_OBLIGATION_CREATED,
        actor=actor,
        target_id=obligation_id,
        target_kind="obligation",
        payload={
            "obligation_type": obligation_type,
            "amount": str(amount),
            "due_date": due_date,
        },
    )


async def emit_report_generated(
    db: AsyncSession,
    organization_id: str,
    submission_id: str,
    *,
    authority: str,
    report_type: str,
    report_period: str,
    actor: str = "system",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_REPORT_GENERATED,
        actor=actor,
        target_id=submission_id,
        target_kind="report_submission",
        payload={
            "authority": authority,
            "report_type": report_type,
            "report_period": report_period,
        },
    )


async def emit_submission_completed(
    db: AsyncSession,
    organization_id: str,
    submission_id: str,
    *,
    status: str,
    authority: str,
    report_type: str,
    report_period: str,
    portal_outcome: str | None = None,
    actor: str = "system",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_SUBMISSION_COMPLETED,
        actor=actor,
        target_id=submission_id,
        target_kind="report_submission",
        payload={
            "status": status,
            "authority": authority,
            "report_type": report_type,
            "report_period": report_period,
            "portal_outcome": portal_outcome,
        },
    )


async def emit_organization_switched(
    db: AsyncSession,
    organization_id: str,
    *,
    user_id: str,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_ORGANIZATION_SWITCHED,
        actor=actor,
        target_id=user_id,
        target_kind="user",
        payload={"organization_id": str(organization_id)},
    )


async def emit_comment_added(
    db: AsyncSession,
    organization_id: str,
    comment_id: str,
    *,
    target_kind: str,
    target_id: str,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_COMMENT_ADDED,
        actor=actor,
        target_id=comment_id,
        target_kind="collaboration_comment",
        payload={"target_kind": target_kind, "target_id": target_id},
    )


async def emit_approval_requested(
    db: AsyncSession,
    organization_id: str,
    approval_id: str,
    *,
    subject_kind: str,
    subject_id: str,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_APPROVAL_REQUESTED,
        actor=actor,
        target_id=approval_id,
        target_kind="approval_request",
        payload={"subject_kind": subject_kind, "subject_id": subject_id},
    )


async def emit_approval_completed(
    db: AsyncSession,
    organization_id: str,
    approval_id: str,
    *,
    status: str,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_APPROVAL_COMPLETED,
        actor=actor,
        target_id=approval_id,
        target_kind="approval_request",
        payload={"status": status},
    )


async def emit_document_requested(
    db: AsyncSession,
    organization_id: str,
    inbox_item_id: str,
    *,
    kind: str,
    actor: str = "user",
) -> None:
    store = get_event_store()
    await store.append(
        db,
        organization_id=str(organization_id),
        event_type=EV_DOCUMENT_REQUESTED,
        actor=actor,
        target_id=inbox_item_id,
        target_kind="operational_inbox",
        payload={"kind": kind},
    )
