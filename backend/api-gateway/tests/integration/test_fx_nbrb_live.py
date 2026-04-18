"""
Живой smoke: эндпоинт /fx/nbrb/rates загружает курсы с www.nbrb.by.

Требуется исходящий HTTPS из раннера (CI: ubuntu-latest). Не включён в verify_like_ci —
см. отдельный job «NBRB FX Smoke» в .github/workflows/ci.yml.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.network
@pytest.mark.asyncio
async def test_nbrb_rates_live_reaches_national_bank(client: AsyncClient):
    r = await client.get("/api/v1/fx/nbrb/rates")
    assert r.status_code == 200, r.text
    data = r.json()
    rates = data.get("rates") or []
    assert len(rates) >= 5, "ожидался непустой справочник НБ РБ"
    codes = {row["code"] for row in rates}
    # Типичные коды в ежедневном курсе
    assert "USD" in codes or "EUR" in codes or "RUB" in codes
    assert data.get("rates_date")
    assert data.get("fetched_at")
