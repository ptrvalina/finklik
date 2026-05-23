"""Ledger validation unit tests."""

from datetime import date
from decimal import Decimal

import pytest

from app.services.ledger_engine import validate_posting


@pytest.mark.asyncio
async def test_validate_posting_rejects_zero_amount():
    """Без БД: проверка суммы выполняется до запросов к chart/period."""
    class _FakeDb:
        pass

    preview = await validate_posting(
        _FakeDb(),
        "00000000-0000-0000-0000-000000000001",
        entry_date=date(2026, 5, 1),
        debit_account="51.1",
        credit_account="60.1",
        amount=Decimal("0"),
    )
    assert not preview.valid
    assert preview.errors
