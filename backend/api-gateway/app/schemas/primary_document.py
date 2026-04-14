from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


DOC_TYPES = ("invoice", "act", "waybill")
DOC_STATUSES = ("draft", "issued", "paid", "cancelled")


class PrimaryDocumentCreate(BaseModel):
    doc_type: str = Field(pattern="^(invoice|act|waybill)$")
    doc_number: str = Field(min_length=1, max_length=40)
    status: str = Field(default="draft", pattern="^(draft|issued|paid|cancelled)$")
    counterparty_id: str | None = None
    transaction_id: str | None = None
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    issue_date: date
    due_date: date | None = None
    currency: str = Field(default="BYN", min_length=3, max_length=3)
    amount_total: Decimal = Field(ge=0)


class PrimaryDocumentUpdate(BaseModel):
    doc_number: str | None = Field(default=None, min_length=1, max_length=40)
    status: str | None = Field(default=None, pattern="^(draft|issued|paid|cancelled)$")
    counterparty_id: str | None = None
    transaction_id: str | None = None
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    amount_total: Decimal | None = Field(default=None, ge=0)


class PrimaryDocumentResponse(BaseModel):
    id: str
    doc_type: str
    doc_number: str
    status: str
    counterparty_id: str | None
    transaction_id: str | None
    title: str | None
    description: str | None
    issue_date: date
    due_date: date | None
    currency: str
    amount_total: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
