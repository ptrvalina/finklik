from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.transaction import EXPENSE_CATEGORIES


class CategorizationRuleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=30)
    transaction_type: str | None = Field(default=None, pattern="^(income|expense|refund|writeoff)$")
    counterparty_id: str | None = None
    description_pattern: str | None = None
    min_amount: Decimal | None = Field(default=None, ge=0)
    max_amount: Decimal | None = Field(default=None, ge=0)
    vat_required: bool | None = None
    priority: int = Field(default=100, ge=1, le=1000)
    is_active: bool = True


class CategorizationRuleResponse(BaseModel):
    id: str
    name: str
    category: str
    transaction_type: str | None = None
    counterparty_id: str | None = None
    description_pattern: str | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    vat_required: bool | None = None
    priority: int
    is_active: bool

    model_config = {"from_attributes": True}


def validate_rule_category(category: str) -> None:
    if category not in EXPENSE_CATEGORIES:
        raise ValueError("Категория правила должна быть из справочника расходов")
