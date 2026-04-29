import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_planner_comments_flow(client: AsyncClient, auth_headers: dict):
    members = await client.get("/api/v1/team/members", headers=auth_headers)
    assert members.status_code == 200
    assignee_id = members.json()["members"][0]["id"]

    created = await client.post(
        "/api/v1/planner/tasks",
        json={
            "title": "Срочно оплатить счёт №123",
            "description": "Проверить назначение и срок",
            "attachments": ["https://example.com/invoice-123.pdf"],
            "assignee_id": assignee_id,
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    task_id = created.json()["id"]

    add_comment = await client.post(
        f"/api/v1/planner/tasks/{task_id}/comments",
        json={"content": "Принято в работу"},
        headers=auth_headers,
    )
    assert add_comment.status_code == 201
    assert add_comment.json()["task_id"] == task_id

    comments = await client.get(f"/api/v1/planner/tasks/{task_id}/comments", headers=auth_headers)
    assert comments.status_code == 200
    data = comments.json()
    assert isinstance(data, list)
    assert any("Принято" in c["content"] for c in data)

    notifications = await client.get("/api/v1/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert isinstance(notifications.json(), list)

    mark_all = await client.post("/api/v1/notifications/read-all", headers=auth_headers)
    assert mark_all.status_code == 200
    assert mark_all.json().get("ok") is True


@pytest.mark.asyncio
async def test_scanner_upload_to_kudir_creates_transaction(client: AsyncClient, auth_headers: dict):
    minimal_jpeg = b"\xff\xd8\xff\xd9"
    files = {"file": ("receipt_demo.jpg", minimal_jpeg, "image/jpeg")}
    resp = await client.post("/api/v1/scanner/upload-to-kudir", files=files, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["transaction_id"]
    assert body["document_id"]
    assert body["source"] == "scan"


@pytest.mark.asyncio
async def test_bank_oauth_import_to_kudir(client: AsyncClient, auth_headers: dict):
    settings.BANK_OAUTH_AUTHORIZE_URL = "https://example-bank.test/oauth/authorize"
    settings.BANK_OAUTH_TOKEN_URL = ""

    acc = await client.post(
        "/api/v1/bank/accounts",
        json={
            "bank_name": "Беларусбанк",
            "bank_bic": "AKBBBY2X",
            "account_number": "BY00TEST00000000000000000000",
            "currency": "BYN",
            "is_primary": True,
        },
        headers=auth_headers,
    )
    assert acc.status_code == 201
    account_id = acc.json()["id"]

    oauth_url = await client.get("/api/v1/bank/oauth/url", params={"account_id": account_id}, headers=auth_headers)
    assert oauth_url.status_code == 200
    assert "oauth_url" in oauth_url.json()

    callback = await client.post(
        "/api/v1/bank/oauth/callback",
        json={"account_id": account_id, "code": "test-code"},
        headers=auth_headers,
    )
    assert callback.status_code == 200

    status = await client.get("/api/v1/bank/oauth/status", params={"account_id": account_id}, headers=auth_headers)
    assert status.status_code == 200
    assert status.json()["connected"] is True

    imported = await client.post(
        "/api/v1/bank/oauth/import",
        json={"account_id": account_id, "date_from": "2026-04-01", "date_to": "2026-04-03"},
        headers=auth_headers,
    )
    assert imported.status_code == 200
    assert imported.json()["import_result"]["created"] >= 1
