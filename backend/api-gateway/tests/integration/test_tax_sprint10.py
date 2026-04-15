"""Sprint 10: production tax calculator details."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_tax_calculation_returns_breakdown_and_deadlines(client: AsyncClient, auth_headers: dict):
    income = await client.post(
        "/api/v1/transactions",
        json={
            "type": "income",
            "amount": 1000,
            "currency": "BYN",
            "transaction_date": "2026-04-10",
            "description": "Выручка",
        },
        headers=auth_headers,
    )
    assert income.status_code == 201

    expense = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": 300,
            "currency": "BYN",
            "transaction_date": "2026-04-12",
            "description": "Расход",
        },
        headers=auth_headers,
    )
    assert expense.status_code == 201

    r = await client.get(
        "/api/v1/tax/calculate",
        params={"period_start": "2026-04-01", "period_end": "2026-04-30", "with_vat": "true"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["tax_regime"] in ("usn_3", "usn_5")
    assert isinstance(data.get("assumptions"), list) and len(data["assumptions"]) >= 1
    assert isinstance(data.get("breakdown"), list) and len(data["breakdown"]) >= 1
    assert data.get("fsszn_deadline")
    # If VAT is included by effective regime/flag, VAT deadline should be present.
    if data.get("vat_to_pay", 0) >= 0:
        assert "vat_deadline" in data
