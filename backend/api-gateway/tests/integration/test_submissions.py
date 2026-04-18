"""Submissions: report draft data is built from ledger / salary when possible."""
import sys

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.skipif(
    sys.version_info >= (3, 14),
    reason="Auth stack (bcrypt/passlib) unreliable on Python 3.14+ — use 3.11 locally (DEVELOPER_GUIDE); CI uses 3.11.",
)


@pytest.mark.asyncio
async def test_submission_usn_uses_ledger_income(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/v1/transactions",
        json={"type": "income", "amount": 10000, "transaction_date": "2026-01-10"},
        headers=auth_headers,
    )
    r = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "imns",
            "report_type": "usn-declaration",
            "report_period": "2026-Q1",
        },
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()["report_data"]
    assert data["source"] == "ledger"
    assert data["numeric"]["income"] == 10000.0


@pytest.mark.asyncio
async def test_submission_vat_uses_ledger(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/v1/transactions",
        json={"type": "income", "amount": 1200, "transaction_date": "2026-04-05"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "amount": 600, "transaction_date": "2026-04-06"},
        headers=auth_headers,
    )
    r = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "imns",
            "report_type": "vat-declaration",
            "report_period": "2026-M04",
        },
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()["report_data"]
    assert data["source"] == "ledger"
    assert data["numeric"]["sales_with_vat"] == 1200.0
    assert data["numeric"]["purchases_with_vat"] == 600.0
