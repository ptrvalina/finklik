"""Integration tests for sprint-6 primary documents APIs."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_primary_document_create_list_and_print(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "invoice",
            "doc_number": "INV-2026-0001",
            "status": "issued",
            "issue_date": "2026-04-14",
            "due_date": "2026-04-21",
            "currency": "BYN",
            "amount_total": 1234.56,
            "title": "Счет на оплату",
            "description": "Оплата услуг",
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    doc = create_resp.json()
    assert doc["doc_type"] == "invoice"
    assert doc["doc_number"] == "INV-2026-0001"

    list_resp = await client.get("/api/v1/primary-documents?doc_type=invoice", headers=auth_headers)
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert any(d["id"] == doc["id"] for d in docs)

    print_resp = await client.get(f"/api/v1/primary-documents/{doc['id']}/print", headers=auth_headers)
    assert print_resp.status_code == 200
    payload = print_resp.json()
    assert payload["printable"] is True
    assert payload["document"]["number"] == "INV-2026-0001"
