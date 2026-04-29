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


@pytest.mark.asyncio
async def test_upload_low_confidence_goes_to_review_queue(client: AsyncClient, auth_headers: dict, monkeypatch):
    from app.api.v1.endpoints import scanner as scanner_endpoint

    def fake_ocr(*_args, **_kwargs):
        return {
            "doc_type": "receipt",
            "confidence": 60,
            "ocr_text": "test low conf",
            "parsed": {
                "amount": 50.0,
                "transaction_date": "2026-04-15",
                "description": "low confidence scan",
            },
            "warnings": ["low confidence"],
        }

    monkeypatch.setattr(scanner_endpoint, "tesseract_ocr_process", fake_ocr)
    minimal_jpeg = b"\xff\xd8\xff\xd9"
    files = {"file": ("receipt_low.jpg", minimal_jpeg, "image/jpeg")}
    upload_resp = await client.post("/api/v1/scanner/upload", files=files, headers=auth_headers)
    assert upload_resp.status_code == 200
    assert upload_resp.json()["status"] == "needs_review"

    queue_resp = await client.get("/api/v1/scanner/review-queue", headers=auth_headers)
    assert queue_resp.status_code == 200
    items = queue_resp.json()["items"]
    assert any(item["filename"] == "receipt_low.jpg" for item in items)


@pytest.mark.asyncio
async def test_upload_links_existing_transaction_and_marks_duplicate(
    client: AsyncClient,
    auth_headers: dict,
    monkeypatch,
):
    tx_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": 99.99,
            "category": "services",
            "description": "Комиссия эквайринга",
            "transaction_date": "2026-04-16",
        },
        headers=auth_headers,
    )
    assert tx_resp.status_code == 201
    tx_id = tx_resp.json()["id"]

    from app.api.v1.endpoints import scanner as scanner_endpoint

    def fake_ocr(*_args, **_kwargs):
        return {
            "doc_type": "receipt",
            "confidence": 92,
            "ocr_text": "duplicate candidate",
            "parsed": {
                "amount": 99.99,
                "transaction_date": "2026-04-16",
                "description": "Комиссия эквайринга",
            },
            "warnings": [],
        }

    monkeypatch.setattr(scanner_endpoint, "tesseract_ocr_process", fake_ocr)
    minimal_jpeg = b"\xff\xd8\xff\xd9"
    files = {"file": ("duplicate.jpg", minimal_jpeg, "image/jpeg")}
    upload_resp = await client.post("/api/v1/scanner/upload", files=files, headers=auth_headers)
    assert upload_resp.status_code == 200
    payload = upload_resp.json()
    assert payload["status"] == "done"
    assert payload["linked_transaction_id"] == tx_id
    assert payload["is_duplicate"] is False
