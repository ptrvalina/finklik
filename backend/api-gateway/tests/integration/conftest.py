"""Фикстуры API: загружаются только для tests/integration/."""
import time

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app import models as _models  # noqa: F401 — регистрация моделей
from app.core.database import Base, get_db
from app.main import app

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture
def onec_worker_uses_test_db(monkeypatch):
    """process_onec_sync_jobs_once использует AsyncSessionLocal из database.py; в тестах — тот же in-memory SQLite."""
    import app.services.onec_sync_service as onec_sync_service

    monkeypatch.setattr(onec_sync_service, "AsyncSessionLocal", TestSessionLocal)


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient):
    """Register a test user and return auth headers."""
    suffix = int(time.time() * 1000) % 999999999
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"test_{suffix}@example.com",
            "password": "TestPass123",
            "full_name": "Тест Иванов",
            "org_name": f"ИП Тест {suffix}",
            "org_unp": f"{str(suffix).zfill(9)[:9]}",
        },
    )
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    tokens = resp.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
