"""Integration tests for user notes API."""
import time

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_notes_crud(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"notes_{suffix}@example.com",
            "password": "NotesPass1",
            "full_name": "Notes User",
            "org_name": f"NotesOrg {suffix}",
            "org_unp": str(suffix).zfill(9)[:9],
        },
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    empty = await client.get("/api/v1/notes", headers=headers)
    assert empty.status_code == 200
    assert empty.json() == []

    created = await client.post(
        "/api/v1/notes",
        headers=headers,
        json={"title": "  Первая  ", "body": "Текст"},
    )
    assert created.status_code == 201
    row = created.json()
    nid = row["id"]
    assert row["title"] == "Первая"
    assert row["body"] == "Текст"

    listed = await client.get("/api/v1/notes", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated = await client.patch(
        f"/api/v1/notes/{nid}",
        headers=headers,
        json={"title": "Другое"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Другое"

    deleted = await client.delete(f"/api/v1/notes/{nid}", headers=headers)
    assert deleted.status_code == 204

    after = await client.get("/api/v1/notes", headers=headers)
    assert after.json() == []
