"""ЭЦП Model A: request → complete с mock-подписью на клиенте."""
import base64
import sys

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.skipif(
    sys.version_info >= (3, 14),
    reason="Auth stack unreliable on Python 3.14+ — use 3.11 locally; CI uses 3.11.",
)


@pytest.mark.asyncio
async def test_signing_request_complete_report_submission(client: AsyncClient, auth_headers: dict):
    sub = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "imns",
            "report_type": "usn-declaration",
            "report_period": "2026-Q1",
        },
        headers=auth_headers,
    )
    assert sub.status_code == 200, sub.text
    submission_id = sub.json()["id"]

    req = await client.post(
        "/api/v1/signing/request",
        json={
            "document_id": submission_id,
            "document_kind": "report_submission",
            "client_metadata": {"ui": "test"},
        },
        headers=auth_headers,
    )
    assert req.status_code == 200, req.text
    body = req.json()
    assert body["document_id"] == submission_id
    assert body["document_kind"] == "report_submission"
    assert len(body["document_hash"]) == 64
    assert body["default_provider"] == "client_side"

    doc_hash = body["document_hash"]
    mock_sig = base64.standard_b64encode(f"MOCK-CMS:{doc_hash}".encode()).decode()

    done = await client.post(
        "/api/v1/signing/complete",
        json={
            "signing_request_id": body["signing_request_id"],
            "signature_base64": mock_sig,
            "certificate_pem": None,
            "certificate_metadata": {"provider": "client_side"},
        },
        headers=auth_headers,
    )
    assert done.status_code == 200, done.text
    out = done.json()
    assert out["status"] == "signed"
    assert out["audit_event"] == "DocumentSigned"
    assert out["signed_document_id"] == submission_id

    status = await client.get(
        f"/api/v1/signing/status/{body['signing_request_id']}",
        headers=auth_headers,
    )
    assert status.status_code == 200, status.text
    assert status.json()["status"] == "signed"


@pytest.mark.asyncio
async def test_signing_complete_rejects_tampered_signature(client: AsyncClient, auth_headers: dict):
    sub = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "fsszn",
            "report_type": "pu-3",
            "report_period": "2026-Q1",
        },
        headers=auth_headers,
    )
    assert sub.status_code == 200, sub.text
    submission_id = sub.json()["id"]

    req = await client.post(
        "/api/v1/signing/request",
        json={"document_id": submission_id, "document_kind": "report_submission"},
        headers=auth_headers,
    )
    assert req.status_code == 200, req.text
    body = req.json()
    bad_sig = base64.standard_b64encode(b"MOCK-CMS:deadbeef".ljust(32)).decode()

    done = await client.post(
        "/api/v1/signing/complete",
        json={
            "signing_request_id": body["signing_request_id"],
            "signature_base64": bad_sig,
        },
        headers=auth_headers,
    )
    assert done.status_code == 400, done.text
