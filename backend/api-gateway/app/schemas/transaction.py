from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import date, datetime


EXPENSE_CATEGORIES = [
    "salary", "rent", "materials", "marketing", "taxes",
    "utilities", "transport", "office", "services", "other",
]
CATEGORY_LABELS = {
    "salary": "Зарплата", "rent": "Аренда", "materials": "Материалы",
    "marketing": "Маркетинг", "taxes": "Налоги", "utilities": "Коммунальные",
    "transport": "Транспорт", "office": "Офис", "services": "Услуги", "other": "Прочее",
}


class TransactionCreate(BaseModel):
    type: str = Field(pattern="^(income|expense|refund|writeoff)$")
    amount: Decimal = Field(gt=0)
    vat_amount: Decimal = Field(default=Decimal("0"), ge=0)
    counterparty_id: str | None = None
    category: str | None = None
    description: str | None = None
    source: str = Field(default="manual", pattern="^(manual|scan|bank)$")
    ai_category_confidence: Decimal | None = Field(default=None, ge=0, le=1)
    receipt_image_url: str | None = None
    transaction_date: date


class TransactionResponse(BaseModel):
    id: str
    type: str
    amount: Decimal
    vat_amount: Decimal
    counterparty_id: str | None = None
    category: str | None = None
    description: str | None
    source: str
    ai_category_confidence: Decimal | None = None
    receipt_image_url: str | None = None
    transaction_date: date
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedTransactions(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    per_page: int


class DashboardMetrics(BaseModel):
    income_current_month: Decimal
    expense_current_month: Decimal
    balance_current_month: Decimal
    tax_usn_quarter: Decimal
    tax_vat_month: Decimal
    tax_fsszn_quarter: Decimal
    next_tax_deadline: date | None
    bank_balance: Decimal
    transactions_this_month: int
    documents_pending_ocr: int
