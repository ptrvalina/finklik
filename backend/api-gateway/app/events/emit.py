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
    EV_DOCUMENT_OCR_PROCESSED,
    EV_OCR_LINKED,
    EV_RECONCILIATION_CONFIRMED,
    EV_RECONCILIATION_MATCH_RECORDED,
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
