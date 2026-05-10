"""Доменный слой Business OS: контекст операций, центры затрат, потоки выручки, обязательства."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.datetime_utils import utc_now_naive


class BusinessEntity(Base):
    """Бизнес-сущность (контрагент в учётном контуре ОС)."""

    __tablename__ = "business_entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    #: client | supplier | internal
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False, default="supplier")
    counterparty_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("counterparties.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)


class CostCenter(Base):
    __tablename__ = "cost_centers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    #: marketing | rent | salary | operations | tax | other
    center_type: Mapped[str] = mapped_column(String(30), nullable=False, default="other")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)


class RevenueStream(Base):
    __tablename__ = "revenue_streams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)


class FinancialObligation(Base):
    __tablename__ = "financial_obligations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    #: tax | invoice | salary | rent
    obligation_type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    #: pending | paid | overdue
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    linked_transaction_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=lambda: [])
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now_naive, onupdate=utc_now_naive, nullable=False
    )


class ReconciliationMatch(Base):
    __tablename__ = "reconciliation_matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    transaction_id: Mapped[str] = mapped_column(String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scanned_documents.id", ondelete="CASCADE"), nullable=False
    )
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, default=Decimal("0.8"))
    #: suggested | confirmed | rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="suggested")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)


class WorkflowAction(Base):
    __tablename__ = "workflow_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(40), nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), nullable=False)
    target_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    performed_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)


class AIMemoryEntry(Base):
    __tablename__ = "ai_memory_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    memory_type: Mapped[str] = mapped_column(String(40), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)
