import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"
    __table_args__ = (
        Index("ix_cat_rule_org_active_priority", "organization_id", "is_active", "priority"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    transaction_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    counterparty_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("counterparties.id"), nullable=True)
    description_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_amount: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    max_amount: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    vat_required: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
