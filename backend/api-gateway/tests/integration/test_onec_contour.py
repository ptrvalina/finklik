"""Спринт 7: реестр контуров 1С."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_contour_status_after_register(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/v1/onec/contour/status", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["contour_key"].startswith("C-")
    assert data["status"] in ("pending_provisioning", "provisioning", "ready", "error", "suspended")
    assert "connection_configured" in data


@pytest.mark.asyncio
async def test_bulk_connections_requires_token(client: AsyncClient):
    r = await client.post("/api/v1/onec/admin/bulk-connections", json={"items": []})
    assert r.status_code == 404
