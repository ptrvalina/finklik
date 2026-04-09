"""Integration tests for transactions endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_transaction(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/transactions", json={
        "type": "income",
        "amount": 1500.00,
        "description": "Тестовый доход",
        "transaction_date": "2026-04-01",
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "income"
    assert float(data["amount"]) == 1500.00
    assert data["description"] == "Тестовый доход"


@pytest.mark.asyncio
async def test_create_expense_with_category(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/transactions", json={
        "type": "expense",
        "amount": 500.00,
        "category": "rent",
        "description": "Аренда офиса",
        "transaction_date": "2026-04-01",
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["category"] == "rent"


@pytest.mark.asyncio
async def test_list_transactions(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/transactions", json={
        "type": "income", "amount": 100, "transaction_date": "2026-04-01",
    }, headers=auth_headers)

    resp = await client.get("/api/v1/transactions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_update_transaction(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/transactions", json={
        "type": "income", "amount": 200, "description": "Оригинал",
        "transaction_date": "2026-04-01",
    }, headers=auth_headers)
    tx_id = create_resp.json()["id"]

    update_resp = await client.put(f"/api/v1/transactions/{tx_id}", json={
        "type": "expense", "amount": 300, "description": "Обновлено",
        "transaction_date": "2026-04-02",
    }, headers=auth_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["description"] == "Обновлено"
    assert float(update_resp.json()["amount"]) == 300.00


@pytest.mark.asyncio
async def test_delete_transaction(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/transactions", json={
        "type": "income", "amount": 50, "transaction_date": "2026-04-01",
    }, headers=auth_headers)
    tx_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_dashboard_metrics(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/dashboard", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "income_current_month" in data
    assert "expense_current_month" in data
    assert "bank_balance" in data


@pytest.mark.asyncio
async def test_filter_by_type(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/transactions", json={
        "type": "income", "amount": 100, "transaction_date": "2026-04-01",
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "type": "expense", "amount": 50, "transaction_date": "2026-04-01",
    }, headers=auth_headers)

    resp = await client.get("/api/v1/transactions?type=income", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(tx["type"] == "income" for tx in items)
