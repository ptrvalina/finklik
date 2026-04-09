from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from app.core.config import settings
from app.core.database import engine, Base
import app.models  # noqa: F401 — регистрирует все модели
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.transactions import router as tx_router
from app.api.v1.endpoints.employees import router as emp_router
from app.api.v1.endpoints.tax_calendar import tax_router, calendar_router
from app.api.v1.endpoints.export import router as export_router
from app.api.v1.endpoints.counterparties import router as cp_router
from app.api.v1.endpoints.scanner import router as scanner_router
from app.api.v1.endpoints.bank import router as bank_router
from app.api.v1.endpoints.onec import router as onec_router
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.import_data import router as import_router
from app.api.v1.endpoints.demo import router as demo_router
from app.api.v1.endpoints.team import router as team_router
from app.api.v1.endpoints.regulatory import router as regulatory_router
from app.api.v1.endpoints.report_submission import router as submission_router
from app.api.v1.endpoints.assistant import router as assistant_router
from app.websocket.router import router as ws_router
from app.security.middleware import SecurityHeadersMiddleware, RateLimitMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup", service="api-gateway", version=settings.APP_VERSION)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()
    log.info("shutdown")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Метрики Prometheus (до прочих middleware — корректный учёт latency)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# Security middleware (порядок важен — сначала безопасность)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роутеры
app.include_router(auth_router, prefix="/api/v1")
app.include_router(tx_router, prefix="/api/v1")
app.include_router(emp_router, prefix="/api/v1")
app.include_router(tax_router, prefix="/api/v1")
app.include_router(calendar_router, prefix="/api/v1")
app.include_router(export_router, prefix="/api/v1")
app.include_router(cp_router, prefix="/api/v1")
app.include_router(scanner_router, prefix="/api/v1")
app.include_router(bank_router, prefix="/api/v1")
app.include_router(onec_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(import_router, prefix="/api/v1")
app.include_router(demo_router, prefix="/api/v1")
app.include_router(team_router, prefix="/api/v1")
app.include_router(regulatory_router, prefix="/api/v1")
app.include_router(submission_router, prefix="/api/v1")
app.include_router(assistant_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/api/v1/health", tags=["system"])
async def api_health():
    return {"status": "ok"}
