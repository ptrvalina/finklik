"""Персистентный аудит снимков FinancialState (Flow 7)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.datetime_utils import utc_now_naive


class FinancialStateAuditEntry(Base):
    """Цепочка изменений производных состояний для трассировки и комплаенса."""

    __tablename__ = "financial_state_audit_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    state_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    previous_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)

    previous_state_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_state_json: Mapped[str] = mapped_column(Text, nullable=False)

    trigger_event: Mapped[str] = mapped_column(String(80), nullable=False)
    source: Mapped[str] = mapped_column(String(60), nullable=False, default="derivation_engine")
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False, default="system")
    actor_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)
