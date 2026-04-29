import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.user import User


async def _make_manager_headers(client: AsyncClient, db_session: AsyncSession, email: str, org_unp: str) -> dict[str, str]:
    register = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "ManagerPass1",
            "full_name": "Менеджер Политики",
            "org_name": "Тест Менеджер Орг",
            "org_unp": org_unp,
        },
    )
    assert register.status_code == 201

    user_q = await db_session.execute(select(User).where(User.email == email))
    user = user_q.scalar_one()
    user.role = "manager"
    await db_session.commit()

    token = create_access_token(str(user.id), str(user.organization_id), "manager")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_manager_forbidden_for_finance_endpoints(client: AsyncClient, db_session: AsyncSession):
    headers = await _make_manager_headers(client, db_session, "manager_policy1@example.com", "987654321")
    blocked = [
        "/api/v1/bank/accounts",
        "/api/v1/reports/monthly-summary",
        "/api/v1/employees",
        "/api/v1/counterparties",
        "/api/v1/billing/plans",
        "/api/v1/team/members",
        "/api/v1/submissions",
        "/api/v1/regulatory/updates",
    ]
    for path in blocked:
        resp = await client.get(path, headers=headers)
        assert resp.status_code == 403, f"{path} expected 403, got {resp.status_code}"


@pytest.mark.asyncio
async def test_manager_allowed_for_planner_and_scanner(client: AsyncClient, db_session: AsyncSession):
    headers = await _make_manager_headers(client, db_session, "manager_policy2@example.com", "987654322")

    planner_list = await client.get("/api/v1/planner/tasks", headers=headers)
    assert planner_list.status_code == 200

    notifications = await client.get("/api/v1/notifications", headers=headers)
    assert notifications.status_code == 200

    parse_text = await client.post(
        "/api/v1/scanner/parse-text",
        json={"text": "КАССОВЫЙ ЧЕК\nИтого: 12,50\nНДС: 2,08", "doc_type": "receipt"},
        headers=headers,
    )
    assert parse_text.status_code == 200
