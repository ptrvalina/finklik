"""Integration tests for demo data seed endpoint."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_seed_demo_data(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/demo/seed", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["seeded"] is True
    assert data["transactions"] > 50
    assert data["counterparties"] >= 1


@pytest.mark.asyncio
async def test_seed_idempotent(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/demo/seed", headers=auth_headers)
    resp = await client.post("/api/v1/demo/seed", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["seeded"] is False
