"""Integration tests for auth endpoints."""
import pytest
import time
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_new_user(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    resp = await client.post("/api/v1/auth/register", json={
        "email": f"new_{suffix}@example.com",
        "password": "SecurePass1",
        "full_name": "Новый Пользователь",
        "org_name": f"Тест-Орг {suffix}",
        "org_unp": str(suffix).zfill(9)[:9],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "refresh_token=" in (resp.headers.get("set-cookie") or "")


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    payload = {
        "email": f"dup_{suffix}@example.com",
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
        "email": f"login_{suffix}@example.com",
        "password": "LoginPass1",
        "full_name": "Логин Тест",
        "org_name": f"ЛогинОрг {suffix}",
        "org_unp": str(suffix).zfill(9)[:9],
    })

    resp = await client.post("/api/v1/auth/login", json={
        "email": f"login_{suffix}@example.com",
        "password": "LoginPass1",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert "refresh_token=" in (resp.headers.get("set-cookie") or "")


@pytest.mark.asyncio
async def test_refresh_works_from_cookie_without_body(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    email = f"cookie_refresh_{suffix}@example.com"
    password = "CookiePass1"
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Cookie Refresh",
            "org_name": f"CookieOrg {suffix}",
            "org_unp": str(suffix).zfill(9)[:9],
        },
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200

    # Для тестового HTTP-клиента принудительно кладем cookie в jar,
    # чтобы проверить fallback чтения refresh именно из cookie.
    login_payload = login.json()
    client.cookies.set("refresh_token", login_payload["refresh_token"])

    # Тело пустое: refresh token должен читаться из httpOnly cookie.
    refreshed = await client.post("/api/v1/auth/refresh", json={})
    assert refreshed.status_code == 200
    payload = refreshed.json()
    assert "access_token" in payload
    assert "refresh_token" in payload
    assert "refresh_token=" in (refreshed.headers.get("set-cookie") or "")


@pytest.mark.asyncio
async def test_refresh_without_json_body_is_401_without_cookie(client: AsyncClient):
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    suffix = int(time.time() * 1000) % 999999999
    await client.post("/api/v1/auth/register", json={
        "email": f"wrongpw_{suffix}@example.com",
        "password": "Correct1",
        "full_name": "Тест",
        "org_name": f"Орг {suffix}",
        "org_unp": str(suffix).zfill(9)[:9],
    })

    resp = await client.post("/api/v1/auth/login", json={
        "email": f"wrongpw_{suffix}@example.com",
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
async def test_me_user_without_organization(client: AsyncClient, db_session: AsyncSession):
    """Пользователь без organization_id не должен получать 500 на /me (регрессия NameError org)."""
    suffix = int(time.time() * 1000) % 999999999
    email = f"noorg_{suffix}@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "TestPass123",
            "full_name": "Без орг",
            "org_name": f"Врем {suffix}",
            "org_unp": str(suffix).zfill(9)[:9],
        },
    )
    r = await db_session.execute(select(User).where(User.email == email))
    u = r.scalar_one()
    u.organization_id = None
    await db_session.commit()

    login = await client.post("/api/v1/auth/login", json={"email": email, "password": "TestPass123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["organization_id"] is None


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_jwt_query_param_is_rejected(client: AsyncClient):
    resp = await client.get("/health?access_token=fake")
    assert resp.status_code == 400
    assert "JWT" in str(resp.json().get("detail", ""))
