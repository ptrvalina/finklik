"""Submissions: report draft data is built from ledger / salary when possible."""
import sys

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.skipif(
    sys.version_info >= (3, 14),
    reason="Auth stack (bcrypt/passlib) unreliable on Python 3.14+ — use 3.11 locally (DEVELOPER_GUIDE); CI uses 3.11.",
)


@pytest.mark.asyncio
async def test_submission_usn_uses_ledger_income(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/v1/transactions",
        json={"type": "income", "amount": 10000, "transaction_date": "2026-01-10"},
        headers=auth_headers,
    )
    r = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "imns",
            "report_type": "usn-declaration",
            "report_period": "2026-Q1",
        },
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()["report_data"]
    assert data["source"] == "ledger"
    assert data["numeric"]["income"] == 10000.0


@pytest.mark.asyncio
async def test_submission_vat_uses_ledger(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/v1/transactions",
        json={"type": "income", "amount": 1200, "transaction_date": "2026-04-05"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "amount": 600, "transaction_date": "2026-04-06"},
        headers=auth_headers,
    )
    r = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "imns",
            "report_type": "vat-declaration",
            "report_period": "2026-M04",
        },
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()["report_data"]
    assert data["source"] == "ledger"
    assert data["numeric"]["sales_with_vat"] == 1200.0
    assert data["numeric"]["purchases_with_vat"] == 600.0


def _stub_submission_settings(**kw):
    d = {
        "DEBUG": False,
        "MOCK_SUBMISSION_REJECT_RATE": 0.0,
        "SUBMISSION_PORTAL_MODE": "mock",
        "SUBMISSION_PORTAL_BASE_URL": "",
        "SUBMISSION_PORTAL_HTTP_TIMEOUT_SEC": 30.0,
        "SUBMISSION_PORTAL_HTTP_RETRIES": 2,
    }
    d.update(kw)
    return type("S", (), d)()


async def _create_confirmed_submission(client: AsyncClient, auth_headers: dict) -> str:
    """pending_review → confirmed."""
    r = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "imns",
            "report_type": "usn-declaration",
            "report_period": "2026-Q1",
        },
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    submission_id = r.json()["id"]
    r2 = await client.post(f"/api/v1/submissions/{submission_id}/confirm", headers=auth_headers)
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "confirmed"
    return submission_id


@pytest.mark.asyncio
async def test_submit_portal_sim_accept_when_debug(client: AsyncClient, auth_headers: dict, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.report_submission.get_settings",
        lambda: _stub_submission_settings(DEBUG=True, MOCK_SUBMISSION_REJECT_RATE=1.0),
    )
    sid = await _create_confirmed_submission(client, auth_headers)
    r = await client.post(
        f"/api/v1/submissions/{sid}/submit",
        params={"portal_sim": "accept"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "accepted"
    assert body["portal_outcome"] == "accepted"


@pytest.mark.asyncio
async def test_submit_portal_sim_reject_when_debug(client: AsyncClient, auth_headers: dict, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.report_submission.get_settings",
        lambda: _stub_submission_settings(DEBUG=True, MOCK_SUBMISSION_REJECT_RATE=0.0),
    )
    sid = await _create_confirmed_submission(client, auth_headers)
    r = await client.post(
        f"/api/v1/submissions/{sid}/submit",
        params={"portal_sim": "reject"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "rejected"
    assert body["portal_outcome"] == "rejected"


@pytest.mark.asyncio
async def test_submit_portal_sim_ignored_when_not_debug(client: AsyncClient, auth_headers: dict, monkeypatch):
    """portal_sim только при DEBUG; иначе — MOCK_SUBMISSION_REJECT_RATE."""
    monkeypatch.setattr(
        "app.api.v1.endpoints.report_submission.get_settings",
        lambda: _stub_submission_settings(DEBUG=False, MOCK_SUBMISSION_REJECT_RATE=0.0),
    )
    sid = await _create_confirmed_submission(client, auth_headers)
    r = await client.post(
        f"/api/v1/submissions/{sid}/submit",
        params={"portal_sim": "reject"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "accepted"
    assert body["portal_outcome"] == "accepted"
