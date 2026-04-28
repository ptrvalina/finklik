from typing import Literal

import re

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from decimal import Decimal
from datetime import date, datetime


# ── Сотрудники ────────────────────────────────────────────────────────────────

class IdentityDocumentPayload(BaseModel):
    """Реквизиты документа, удостоверяющего личность (хранятся зашифрованно)."""

    series: str | None = Field(None, max_length=32)
    number: str = Field(min_length=1, max_length=64)
    issued_by: str = Field(min_length=1, max_length=500)
    issued_date: date
    expiry_date: date | None = None


class IdentityDocumentOut(BaseModel):
    series: str | None = None
    number: str
    issued_by: str
    issued_date: date
    expiry_date: date | None = None


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    identification_number: str | None = Field(default=None, max_length=14)
    position: str = Field(min_length=2, max_length=255)
    salary: Decimal = Field(gt=0)
    hire_date: date
    has_children: int = Field(default=0, ge=0)
    disability_group: Literal[1, 2, 3] | None = None
    is_pensioner: bool = False
    citizenship: str | None = Field(None, max_length=255)
    work_hours_per_day: Decimal | None = Field(None, ge=0, le=24)
    work_hours_per_week: Decimal | None = Field(None, ge=0, le=168)
    id_document_type: str | None = Field(
        None,
        max_length=40,
        description="passport | residence_permit | refugee_certificate | other",
    )
    id_document: IdentityDocumentPayload | None = None
    passport_data: str | None = Field(default=None, min_length=2, max_length=2000)
    phone: str | None = Field(default=None, min_length=5, max_length=40)
    email: EmailStr | None = None
    address: str | None = Field(default=None, min_length=2, max_length=500)

    @field_validator("id_document_type")
    @classmethod
    def normalize_doc_type(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        return v.strip().lower()

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        raw = v.strip()
        digits = re.sub(r"[^\d+]", "", raw)
        if len(digits) < 10 or len(digits) > 16:
            raise ValueError("Укажите корректный номер телефона")
        return raw

    @model_validator(mode="after")
    def document_fields(self):
        if self.id_document_type and not self.id_document:
            raise ValueError("Заполните реквизиты документа или уберите вид документа")
        if self.id_document and not self.id_document_type:
            raise ValueError("Укажите вид документа, удостоверяющего личность")
        return self


class EmployeeUpdate(BaseModel):
    position: str | None = None
    salary: Decimal | None = None
    identification_number: str | None = None
    has_children: int | None = None
    disability_group: Literal[1, 2, 3] | None = None
    is_pensioner: bool | None = None
    citizenship: str | None = None
    work_hours_per_day: Decimal | None = Field(None, ge=0, le=24)
    work_hours_per_week: Decimal | None = Field(None, ge=0, le=168)
    id_document_type: str | None = Field(None, max_length=40)
    id_document: IdentityDocumentPayload | None = None
    fire_date: date | None = None

    @field_validator("id_document_type")
    @classmethod
    def normalize_doc_type(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        return v.strip().lower()


class EmployeeResponse(BaseModel):
    id: str
    full_name: str
    identification_number: str | None = None
    position: str
    salary: Decimal
    hire_date: date
    fire_date: date | None
    is_active: bool
    has_children: int
    disability_group: int | None = None
    is_pensioner: bool = False
    citizenship: str | None = None
    work_hours_per_day: Decimal | None = None
    work_hours_per_week: Decimal | None = None
    id_document_type: str | None = None
    id_document: IdentityDocumentOut | None = None
    passport_data: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Зарплата ──────────────────────────────────────────────────────────────────

class SalaryCalculateRequest(BaseModel):
    employee_id: str
    period_year: int = Field(ge=2020, le=2030)
    period_month: int = Field(ge=1, le=12)
    bonus: Decimal = Field(default=Decimal("0"), ge=0)
    sick_days: int = Field(default=0, ge=0)
    vacation_days: int = Field(default=0, ge=0)
    work_days_plan: int = Field(default=21, ge=1)


class SalaryResponse(BaseModel):
    id: str
    employee_id: str
    period_year: int
    period_month: int
    base_salary: Decimal
    bonus: Decimal
    sick_pay: Decimal
    vacation_pay: Decimal
    gross_salary: Decimal
    income_tax: Decimal
    fsszn_employee: Decimal
    net_salary: Decimal
    fsszn_employer: Decimal
    status: str

    model_config = {"from_attributes": True}


# ── Налоги ────────────────────────────────────────────────────────────────────

class TaxCalculationResult(BaseModel):
    period_start: date
    period_end: date
    tax_regime: str

    income: Decimal
    expense: Decimal
    tax_base: Decimal

    usn_rate: Decimal
    usn_amount: Decimal
    usn_paid: Decimal
    usn_to_pay: Decimal

    vat_sales: Decimal
    vat_purchases: Decimal
    vat_to_pay: Decimal

    fsszn_fot: Decimal
    fsszn_employer_rate: Decimal
    fsszn_employer_amount: Decimal
    fsszn_employee_amount: Decimal

    total_to_pay: Decimal
    deadline: date
    vat_deadline: date | None = None
    fsszn_deadline: date | None = None
    assumptions: list[str] = Field(default_factory=list)
    breakdown: list[str] = Field(default_factory=list)
    regulatory_version: str | None = None
    regulatory_year: int | None = None


# ── Календарь ─────────────────────────────────────────────────────────────────

class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    event_date: date
    event_type: str = "custom"
    color: str = "#2563EB"
    remind_days_before: int = Field(default=3, ge=0, le=30)
    is_recurring: bool = False
    recurrence_rule: str | None = None


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_date: date | None = None
    color: str | None = None
    remind_days_before: int | None = None


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    description: str | None
    event_date: date
    event_type: str
    color: str
    is_auto: bool
    remind_days_before: int
    is_recurring: bool

    model_config = {"from_attributes": True}
