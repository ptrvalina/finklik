"""Integration tests for bank and 1C mock endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_banks(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/bank/banks", headers=auth_headers)
    assert resp.status_code == 200
    banks = resp.json()["banks"]
    assert len(banks) >= 5
    assert any(b["name"] == "Беларусбанк" for b in banks)


@pytest.mark.asyncio
async def test_create_and_list_bank_account(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/bank/accounts", json={
        "bank_name": "Беларусбанк",
        "bank_bic": "AKBBBY2X",
        "account_number": "BY20AKBB30120000000040000000",
        "is_primary": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    acc = resp.json()
    assert acc["bank_name"] == "Беларусбанк"
    assert acc["is_primary"] is True

    list_resp = await client.get("/api/v1/bank/accounts", headers=auth_headers)
    assert list_resp.status_code == 200
    accs = list_resp.json()["accounts"]
    assert len(accs) >= 1


@pytest.mark.asyncio
async def test_get_balance(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/bank/balance", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "balance" in data
    assert "currency" in data


@pytest.mark.asyncio
async def test_get_statements(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/bank/statements", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "transactions" in data


@pytest.mark.asyncio
async def test_create_payment(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/bank/payment", json={
        "amount": 100.0,
        "recipient_name": "ООО Тест",
        "description": "Тестовый платёж",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"


@pytest.mark.asyncio
async def test_onec_health(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/onec/health", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is True
    assert data["mode"] == "mock"


@pytest.mark.asyncio
async def test_onec_lookup_counterparty(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/onec/counterparty/lookup?unp=100000001", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is True
    assert "name" in data


@pytest.mark.asyncio
async def test_onec_search_counterparty(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/onec/counterparty/search?q=Минский", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) >= 1


@pytest.mark.asyncio
async def test_onec_chart_of_accounts(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/onec/accounts", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "accounts" in data
    assert len(data["accounts"]) > 5
