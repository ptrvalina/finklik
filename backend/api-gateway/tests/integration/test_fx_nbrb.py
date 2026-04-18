"""Интеграция: эндпоинты курсов НБ (status без внешнего вызова)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_nbrb_fx_status(client: AsyncClient):
    r = await client.get("/api/v1/fx/nbrb/status")
    assert r.status_code == 200
    data = r.json()
    assert "enabled" in data
    assert "has_data" in data
