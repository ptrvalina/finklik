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
    assert doc.get("related_document_id") is None

    list_resp = await client.get("/api/v1/primary-documents?doc_type=invoice", headers=auth_headers)
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert any(d["id"] == doc["id"] for d in docs)

    print_resp = await client.get(f"/api/v1/primary-documents/{doc['id']}/print", headers=auth_headers)
    assert print_resp.status_code == 200
    assert print_resp.content[:4] == b"%PDF"
    assert print_resp.headers.get("content-type", "").startswith("application/pdf")


@pytest.mark.asyncio
async def test_primary_document_next_number_preview(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/v1/primary-documents/next-number", params={"doc_type": "invoice"}, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["doc_type"] == "invoice"
    assert "suggested_number" in data
    assert data["suggested_number"].startswith("СЧ-")


@pytest.mark.asyncio
async def test_primary_document_auto_number(client: AsyncClient, auth_headers: dict):
    r1 = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "waybill",
            "use_auto_number": True,
            "status": "draft",
            "issue_date": "2026-04-14",
            "currency": "BYN",
            "amount_total": 100,
        },
        headers=auth_headers,
    )
    assert r1.status_code == 201
    n1 = r1.json()["doc_number"]
    assert n1.startswith("ТН-")

    r2 = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "waybill",
            "use_auto_number": True,
            "status": "draft",
            "issue_date": "2026-04-14",
            "currency": "BYN",
            "amount_total": 50,
        },
        headers=auth_headers,
    )
    assert r2.status_code == 201
    n2 = r2.json()["doc_number"]
    assert n1 != n2


@pytest.mark.asyncio
async def test_primary_document_act_linked_to_invoice(client: AsyncClient, auth_headers: dict):
    inv = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "invoice",
            "use_auto_number": True,
            "status": "issued",
            "issue_date": "2026-04-14",
            "currency": "BYN",
            "amount_total": 500,
        },
        headers=auth_headers,
    )
    assert inv.status_code == 201
    inv_id = inv.json()["id"]

    act = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "act",
            "use_auto_number": True,
            "related_document_id": inv_id,
            "status": "issued",
            "issue_date": "2026-04-15",
            "currency": "BYN",
            "amount_total": 500,
        },
        headers=auth_headers,
    )
    assert act.status_code == 201
    assert act.json()["related_document_id"] == inv_id


@pytest.mark.asyncio
async def test_primary_document_act_rejects_non_invoice_link(client: AsyncClient, auth_headers: dict):
    wb = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "waybill",
            "doc_number": "WB-LINK-1",
            "status": "draft",
            "issue_date": "2026-04-14",
            "currency": "BYN",
            "amount_total": 1,
        },
        headers=auth_headers,
    )
    assert wb.status_code == 201
    wb_id = wb.json()["id"]

    act_bad = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "act",
            "doc_number": "ACT-BAD2",
            "related_document_id": wb_id,
            "status": "draft",
            "issue_date": "2026-04-14",
            "currency": "BYN",
            "amount_total": 1,
        },
        headers=auth_headers,
    )
    assert act_bad.status_code == 400
