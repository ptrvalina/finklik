"""Эндпоинт /metrics для Prometheus."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_metrics_endpoint(client: AsyncClient):
    r = await client.get("/metrics")
    assert r.status_code == 200
    body = r.text
    # Формат Prometheus text exposition
    assert "# HELP" in body or "# TYPE" in body
