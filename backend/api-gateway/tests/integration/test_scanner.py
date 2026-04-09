"""Integration tests for scanner endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_parse_text_ttn(client: AsyncClient, auth_headers: dict):
    ttn_text = """
    ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ № ТТН-5678
    Грузоотправитель: ОАО Минский молочный завод
    УНП: 100000001
    Грузополучатель: ООО ПромТехСервис
    УНП: 100000002
    Дата: 01.04.2026

    1  Молоко 3.2%     л    100   2,50    250,00
    2  Сметана 20%     кг    50   5,00    250,00

    Итого: 500,00
    НДС: 83,33
    """
    resp = await client.post("/api/v1/scanner/parse-text", json={
        "text": ttn_text,
        "doc_type": "ttn",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["doc_type"] == "ttn"
    assert data["confidence"] > 0
    assert "parsed" in data


@pytest.mark.asyncio
async def test_parse_text_generic(client: AsyncClient, auth_headers: dict):
    text = """
    КАССОВЫЙ ЧЕК
    ОАО Евроопт
    Дата: 05.04.2026
    Итого: 45,60
    НДС: 7,60
    """
    resp = await client.post("/api/v1/scanner/parse-text", json={
        "text": text,
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "parsed" in data
    assert data["parsed"]["amount"] == 45.60


@pytest.mark.asyncio
async def test_parse_text_too_short(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/scanner/parse-text", json={
        "text": "short",
    }, headers=auth_headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_scanned_documents(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/scanner/documents", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_upload_ttn_filename_uses_ttn_pipeline(client: AsyncClient, auth_headers: dict):
    """Имя файла с «ттн» → mock OCR + ttn_extractor."""
    minimal_jpeg = b"\xff\xd8\xff\xd9"
    files = {"file": ("накладная_ттн_demo.jpg", minimal_jpeg, "image/jpeg")}
    resp = await client.post("/api/v1/scanner/upload", files=files, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["doc_type"] == "ttn"
    assert "parsed" in data
    assert data["parsed"].get("amount", 0) > 0
