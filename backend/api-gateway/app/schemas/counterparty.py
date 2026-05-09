from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime, date


class CounterpartyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    unp: str = Field(min_length=9, max_length=9, pattern=r"^\d{9}$")
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_account: str | None = None
    bank_name: str | None = None
    notes: str | None = None
    cp_kind: str = Field(default="both", pattern=r"^(supplier|customer|both)$")


class CounterpartyQuickUnp(BaseModel):
    """Два клика: УНП → запись (название подставляется или задаётся вручную; ЕГР — отдельная интеграция)."""

    unp: str = Field(min_length=9, max_length=9, pattern=r"^\d{9}$")
    name: str | None = Field(None, max_length=255)


class CounterpartyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_account: str | None = None
    bank_name: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    cp_kind: str | None = Field(None, pattern=r"^(supplier|customer|both)$")
    is_pinned: bool | None = None


class CounterpartyResponse(BaseModel):
    id: str
    name: str
    unp: str
    address: str | None
    phone: str | None
    email: str | None
    bank_account: str | None
    bank_name: str | None
    notes: str | None
    cp_kind: str = "both"
    is_pinned: bool = False
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CounterpartyListResponse(CounterpartyResponse):
    balance_net: str = "0"
    last_transaction_date: date | None = None
    last_transaction_amount: str | None = None
    week_tx_count: int = 0


def decimal_str(d: Decimal | None) -> str:
    if d is None:
        return "0"
    s = format(d, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"
