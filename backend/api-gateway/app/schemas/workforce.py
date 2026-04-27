"""Schemas for HR, FSZN and salary APIs."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

import re

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class EmployeeCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    passport_data: str = Field(min_length=2, max_length=2000)
    phone: str = Field(min_length=5, max_length=40)
    email: EmailStr
    address: str = Field(min_length=2, max_length=500)
    hire_date: date
    salary: Decimal = Field(gt=0)
    position_code: str = Field(min_length=1, max_length=80)
    position_name: str = Field(min_length=1, max_length=255)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        raw = v.strip()
        digits = re.sub(r"[^\d+]", "", raw)
        if len(digits) < 10 or len(digits) > 16:
            raise ValueError("Укажите корректный номер телефона (минимум 10 цифр)")
        return raw

    @field_validator("hire_date")
    @classmethod
    def hire_not_future(cls, v: date) -> date:
        from datetime import date as date_cls

        if v > date_cls.today():
            raise ValueError("Дата приёма не может быть в будущем")
        return v


class EmployeeDTO(BaseModel):
    id: str
    tenant_id: str
    full_name: str
    passport_data: str | None
    phone: str | None
    email: str | None
    address: str | None
    hire_date: date
    salary: Decimal
    position_code: str | None
    position_name: str | None
    created_at: datetime
    terminated_at: datetime | None


class TerminateEmployeeRequest(BaseModel):
    termination_date: date

    @field_validator("termination_date")
    @classmethod
    def termination_not_future(cls, v: date) -> date:
        from datetime import date as date_cls

        if v > date_cls.today():
            raise ValueError("Дата увольнения не может быть в будущем")
        return v


class FsznRequest(BaseModel):
    employee_id: str | None = None
    period: date | None = None
    xml_data: str | None = None


class FsznResponse(BaseModel):
    protocol_id: str
    status: str


class SalaryCalculationRequest(BaseModel):
    employee_id: str
    period_start: date
    period_end: date

    @model_validator(mode="after")
    def period_order(self) -> SalaryCalculationRequest:
        if self.period_end < self.period_start:
            raise ValueError("period_end не может быть раньше period_start")
        return self


class SalaryCalculationDTO(BaseModel):
    id: str
    employee_id: str
    period: date
    base_salary: Decimal
    bonuses: Decimal
    deductions: Decimal
    taxes: Decimal
    net_salary: Decimal
    status: str

