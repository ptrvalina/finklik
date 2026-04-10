"""Shared test fixtures for FinKlik backend tests."""
import os
import sys
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key_12345678901234567890")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test_refresh_key_12345678901234567890")
os.environ.setdefault("DISABLE_RATE_LIMIT", "1")

from app.core.database import Base
from app.main import app
from app.core.database import get_db
from app import models as _models  # noqa: F401 — side effect: register models in metadata


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


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient):
    """Register a test user and return auth headers."""
    import time
    suffix = int(time.time() * 1000) % 999999999
    resp = await client.post("/api/v1/auth/register", json={
        "email": f"test_{suffix}@test.by",
        "password": "TestPass123",
        "full_name": "Тест Иванов",
        "org_name": f"ИП Тест {suffix}",
        "org_unp": f"{str(suffix).zfill(9)[:9]}",
    })
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    tokens = resp.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
