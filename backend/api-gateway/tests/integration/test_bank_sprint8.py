"""Спринт 8: импорт выписки и сверка."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_bank_statement_import_and_reconciliation(client: AsyncClient, auth_headers: dict):
    imp = await client.post(
        "/api/v1/bank/statement/import",
        json={
            "lines": [
                {
                    "transaction_date": "2026-04-10",
                    "amount": 50.25,
                    "direction": "credit",
                    "description": "Тест импорта банка",
                }
            ]
        },
        headers=auth_headers,
    )
    assert imp.status_code == 200
    assert imp.json()["created"] >= 1

    rec = await client.get(
        "/api/v1/bank/reconciliation",
        params={"date_from": "2026-04-01", "date_to": "2026-04-30"},
        headers=auth_headers,
    )
    assert rec.status_code == 200
    body = rec.json()
    assert "book" in body and "bank_import" in body
    assert "delta_net_book_minus_bank_import" in body


@pytest.mark.asyncio
async def test_primary_document_payment_qr_invoice_only(client: AsyncClient, auth_headers: dict):
    create = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "invoice",
            "use_auto_number": True,
            "status": "issued",
            "issue_date": "2026-04-15",
            "currency": "BYN",
            "amount_total": 99.99,
        },
        headers=auth_headers,
    )
    assert create.status_code == 201
    doc_id = create.json()["id"]

    qr = await client.get(f"/api/v1/primary-documents/{doc_id}/payment-qr", headers=auth_headers)
    assert qr.status_code == 200
    data = qr.json()
    assert data["qr_png_base64"]
    assert data["payment_url"]

    act = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "act",
            "use_auto_number": True,
            "status": "draft",
            "issue_date": "2026-04-15",
            "currency": "BYN",
            "amount_total": 1,
        },
        headers=auth_headers,
    )
    aid = act.json()["id"]
    bad = await client.get(f"/api/v1/primary-documents/{aid}/payment-qr", headers=auth_headers)
    assert bad.status_code == 400
