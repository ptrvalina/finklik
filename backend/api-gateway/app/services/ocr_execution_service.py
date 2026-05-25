"""OCR → execution: предложения операции, счетов, категории."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.expense_ai_classifier import classify_expense_category

_DOC_ACCOUNT_HINTS: dict[str, dict[str, str]] = {
    "receipt": {"debit": "44.1", "credit": "51.1"},
    "invoice": {"debit": "60.1", "credit": "51.1"},
    "act": {"debit": "26.1", "credit": "60.1"},
    "payment_order": {"debit": "60.1", "credit": "51.1"},
    "ttn": {"debit": "10.1", "credit": "60.1"},
    "kudir": {"debit": "26.1", "credit": "51.1"},
    "payroll": {"debit": "70.1", "credit": "51.1"},
}


async def build_execution_suggestions(
    db: AsyncSession,
    organization_id: str,
    *,
    parsed: dict[str, Any],
    doc_type: str,
    vendor_hints: dict | None,
    requires_review: bool,
    linked_transaction_id: str | None = None,
) -> dict[str, Any]:
    amount = parsed.get("amount") or 0
    try:
        amount_dec = Decimal(str(amount))
    except Exception:
        amount_dec = Decimal("0")

    category = (vendor_hints or {}).get("default_category")
    if not category and parsed.get("description"):
        cat, _conf = classify_expense_category(parsed.get("description") or "")
        category = cat

    accounts = {
        "debit": (vendor_hints or {}).get("default_debit_account"),
        "credit": (vendor_hints or {}).get("default_credit_account"),
    }
    if not accounts["debit"] or not accounts["credit"]:
        hint = _DOC_ACCOUNT_HINTS.get(doc_type) or {"debit": "60.1", "credit": "51.1"}
        accounts = {k: accounts[k] or hint[k] for k in ("debit", "credit")}

    tx_type = parsed.get("type") or "expense"
    if doc_type == "invoice" and amount_dec > 0:
        tx_type = "expense"

    suggestion = {
        "type": tx_type,
        "amount": str(amount_dec) if amount_dec > 0 else None,
        "vat_amount": str(parsed.get("vat_amount")) if parsed.get("vat_amount") else None,
        "description": parsed.get("description") or parsed.get("counterparty_name"),
        "transaction_date": parsed.get("transaction_date"),
        "counterparty_name": parsed.get("counterparty_name"),
        "category": category,
        "debit_account": accounts["debit"],
        "credit_account": accounts["credit"],
    }

    out: dict[str, Any] = {
        "suggested_transaction": suggestion,
        "suggested_accounts": accounts,
        "suggested_category": category,
        "auto_link_transaction_id": linked_transaction_id,
        "create_work_pack": bool(requires_review and not linked_transaction_id),
        "work_pack_reason": "ocr_needs_review" if requires_review else None,
    }
    if linked_transaction_id:
        out["message"] = "Найдена похожая операция — можно связать без дубля."
    elif requires_review:
        out["message"] = "Проверьте поля и создайте операцию одним действием."
    else:
        out["message"] = "Данные готовы — подтвердите операцию."
    return out
