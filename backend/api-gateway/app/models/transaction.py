import uuid
from datetime import datetime, date
from sqlalchemy import String, Numeric, DateTime, Date, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal
from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_tx_org_date", "organization_id", "transaction_date"),
        Index("ix_tx_org_type", "organization_id", "type"),
        Index("ix_tx_org_category", "organization_id", "category"),
        Index("ix_tx_org_status", "organization_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), default="BYN")
    counterparty_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("counterparties.id"), nullable=True)
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="transactions")
