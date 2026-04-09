"""Импорт транзакций из CSV."""
import io

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_csv_preview(client: AsyncClient, auth_headers: dict):
    csv_body = (
        "Дата;Тип;Сумма;Описание;Категория\r\n"
        "2026-01-15;расход;100,50;Тест;materials\r\n"
        "2026-01-16;доход;250;Оплата клиента;services\r\n"
    )
    files = {"file": ("tx.csv", io.BytesIO(csv_body.encode("utf-8-sig")), "text/csv")}
    resp = await client.post("/api/v1/import/transactions-csv/preview", files=files, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_parsed"] == 2
    assert len(data["preview"]) == 2
    assert data["preview"][0].get("type") == "expense"
