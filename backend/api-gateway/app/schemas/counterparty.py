from pydantic import BaseModel, Field
from datetime import datetime


class CounterpartyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    unp: str = Field(min_length=9, max_length=9, pattern=r"^\d{9}$")
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_account: str | None = None
    bank_name: str | None = None
    notes: str | None = None


class CounterpartyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_account: str | None = None
    bank_name: str | None = None
    notes: str | None = None
    is_active: bool | None = None


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
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
