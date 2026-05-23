"""План счетов РБ, субсчета, проводки, ОС/амортизация."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.datetime_utils import utc_now_naive


class ChartAccount(Base):
    """Официальный синтетический счёт (общий для всех организаций)."""

    __tablename__ = "chart_accounts"
    __table_args__ = (UniqueConstraint("code", name="uq_chart_accounts_code"),)

    code: Mapped[str] = mapped_column(String(8), primary_key=True)
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    account_class: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_type: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    is_off_balance: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ChartSubaccount(Base):
    """Субсчёт организации (редактируемый, иерархия через parent_id)."""

    __tablename__ = "chart_subaccounts"
    __table_args__ = (
        UniqueConstraint("organization_id", "full_code", name="uq_chart_subaccount_org_code"),
        Index("ix_chart_subaccount_org_parent", "organization_id", "parent_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    parent_account_code: Mapped[str] = mapped_column(String(8), ForeignKey("chart_accounts.code"), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chart_subaccounts.id"), nullable=True)
    full_code: Mapped[str] = mapped_column(String(32), nullable=False)
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)


class LedgerEntry(Base):
    """Бухгалтерская проводка (advanced mode)."""

    __tablename__ = "ledger_entries"
    __table_args__ = (
        Index("ix_ledger_org_date", "organization_id", "entry_date"),
        Index("ix_ledger_org_source", "organization_id", "source_type", "source_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    debit_account: Mapped[str] = mapped_column(String(32), nullable=False)
    credit_account: Mapped[str] = mapped_column(String(32), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="BYN")
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    analytics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)


class FixedAsset(Base):
    __tablename__ = "fixed_assets"
    __table_args__ = (Index("ix_fixed_assets_org", "organization_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    inventory_number: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    useful_life_months: Mapped[int] = mapped_column(Integer, nullable=False)
    depreciation_method: Mapped[str] = mapped_column(String(20), default="straight_line")
    salvage_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    asset_account: Mapped[str] = mapped_column(String(8), default="01")
    depreciation_account: Mapped[str] = mapped_column(String(8), default="02")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)


class AmortizationEntry(Base):
    __tablename__ = "amortization_entries"
    __table_args__ = (Index("ix_amort_org_period", "organization_id", "period_year", "period_month"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    fixed_asset_id: Mapped[str] = mapped_column(String(36), ForeignKey("fixed_assets.id"), nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    ledger_entry_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("ledger_entries.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)
