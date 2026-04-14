"""Импорт банковских операций и сверка (спринт 8)."""
from datetime import date

from pydantic import BaseModel, Field


class StatementLineImport(BaseModel):
    transaction_date: date
    amount: float = Field(gt=0)
    direction: str = Field(pattern="^(credit|debit)$")
    description: str = Field(min_length=1, max_length=2000)


class StatementImportPayload(BaseModel):
    lines: list[StatementLineImport] = Field(min_length=1, max_length=2000)
