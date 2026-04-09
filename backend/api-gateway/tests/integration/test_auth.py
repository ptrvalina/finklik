"""Integration tests for auth endpoints."""
import pytest
import time
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_new_user(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    resp = await client.post("/api/v1/auth/register", json={
        "email": f"new_{suffix}@test.by",
        "password": "SecurePass1",
        "full_name": "Новый Пользователь",
        "org_name": f"Тест-Орг {suffix}",
        "org_unp": str(suffix).zfill(9)[:9],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    payload = {
        "email": f"dup_{suffix}@test.by",
        "password": "SecurePass1",
        "full_name": "Дубль",
        "org_name": f"ДублОрг {suffix}",
        "org_unp": str(suffix).zfill(9)[:9],
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    payload["org_unp"] = str(suffix + 1).zfill(9)[:9]
    payload["org_name"] = f"ДублОрг2 {suffix}"
    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    await client.post("/api/v1/auth/register", json={
        "email": f"login_{suffix}@test.by",
        "password": "LoginPass1",
        "full_name": "Логин Тест",
        "org_name": f"ЛогинОрг {suffix}",
        "org_unp": str(suffix).zfill(9)[:9],
    })

    resp = await client.post("/api/v1/auth/login", json={
        "email": f"login_{suffix}@test.by",
        "password": "LoginPass1",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    await client.post("/api/v1/auth/register", json={
        "email": f"wrongpw_{suffix}@test.by",
        "password": "Correct1",
        "full_name": "Тест",
        "org_name": f"Орг {suffix}",
        "org_unp": str(suffix).zfill(9)[:9],
    })

    resp = await client.post("/api/v1/auth/login", json={
        "email": f"wrongpw_{suffix}@test.by",
        "password": "WrongPass1",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "email" in data
    assert "full_name" in data


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)
