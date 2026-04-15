"""Buyer-demo smoke tests for critical user flows."""

from pathlib import Path

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_buyer_demo_invoice_payment_smoke(client: AsyncClient, auth_headers: dict):
    created = await client.post(
        "/api/v1/primary-documents",
        json={
            "doc_type": "invoice",
            "use_auto_number": True,
            "status": "issued",
            "issue_date": "2026-04-17",
            "currency": "BYN",
            "amount_total": 90.25,
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    doc_id = created.json()["id"]

    qr = await client.get(f"/api/v1/primary-documents/{doc_id}/payment-qr", headers=auth_headers)
    assert qr.status_code == 200
    assert f"pay={doc_id}" in qr.json()["payment_url"]

    old_secret = settings.PAYMENT_WEBHOOK_SECRET
    settings.PAYMENT_WEBHOOK_SECRET = "smoke-secret"
    try:
        webhook = await client.post(
            "/api/v1/primary-documents/webhooks/payment",
            json={
                "doc_id": doc_id,
                "status": "paid",
                "payment_id": "smoke-pay-1",
                "amount": 90.25,
                "currency": "BYN",
            },
            headers={"X-Payment-Webhook-Secret": "smoke-secret"},
        )
    finally:
        settings.PAYMENT_WEBHOOK_SECRET = old_secret
    assert webhook.status_code == 200

    status = await client.get(f"/api/v1/primary-documents/{doc_id}/payment-status", headers=auth_headers)
    assert status.status_code == 200
    assert status.json()["is_paid"] is True

    events = await client.get(f"/api/v1/primary-documents/{doc_id}/payment-events", headers=auth_headers)
    assert events.status_code == 200
    summary = events.json()["summary"]
    assert summary["webhook_success"] >= 1
    assert summary["total"] >= 1


@pytest.mark.asyncio
async def test_buyer_demo_tax_rules_fallback_smoke(client: AsyncClient, auth_headers: dict):
    from app.services import tax_calculator as tax_calc_module

    config_path = Path(tax_calc_module.__file__).resolve().parent.parent / "config" / "tax_rules.json"
    had_config = config_path.is_file()
    backup = config_path.read_text(encoding="utf-8") if had_config else None
    try:
        config_path.write_text('{"years": ', encoding="utf-8")
        response = await client.get("/api/v1/tax/rules/validate", headers=auth_headers)
        assert response.status_code == 200
        payload = response.json()
        assert payload["using_fallback"] is True
        assert isinstance(payload.get("errors"), list) and payload["errors"]
    finally:
        if had_config and backup is not None:
            config_path.write_text(backup, encoding="utf-8")
        elif config_path.exists():
            config_path.unlink()
