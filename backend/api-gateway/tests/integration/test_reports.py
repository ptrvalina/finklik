"""Integration tests for reports and analytics endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_monthly_summary(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/transactions", json={
        "type": "income", "amount": 5000, "transaction_date": "2026-04-01",
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "type": "expense", "amount": 2000, "category": "rent",
        "transaction_date": "2026-04-02",
    }, headers=auth_headers)

    resp = await client.get("/api/v1/reports/monthly-summary?year=2026", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "months" in data
    assert len(data["months"]) == 12
    assert "total_income" in data
    assert "total_expense" in data
    assert "profit" in data


@pytest.mark.asyncio
async def test_expense_categories(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/transactions", json={
        "type": "expense", "amount": 1000, "category": "salary",
        "transaction_date": "2026-04-01",
    }, headers=auth_headers)

    resp = await client.get("/api/v1/reports/expense-categories", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "grand_total" in data


@pytest.mark.asyncio
async def test_counterparty_turnover(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/reports/counterparty-turnover", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data


@pytest.mark.asyncio
async def test_income_expense_trend(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/reports/income-expense-trend?months=3", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "points" in data
