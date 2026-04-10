from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import structlog

from app.core.config import settings
from app.core.database import engine, Base
from app import models as _models  # noqa: F401 — side effect: регистрация моделей в metadata
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

_REPO_ROOT = Path(__file__).resolve().parent.parent
_STATIC_SWAGGER = _REPO_ROOT / "static" / "swagger-ui"
_STATIC_REDOC = _REPO_ROOT / "static" / "redoc"
USE_LOCAL_DOCS = (_STATIC_SWAGGER / "swagger-ui-bundle.js").is_file() and (
    _STATIC_REDOC / "redoc.standalone.js"
).is_file()


@asynccontextmanager
async def lifespan(application: FastAPI):
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
    docs_url=None if USE_LOCAL_DOCS else "/docs",
    redoc_url=None if USE_LOCAL_DOCS else "/redoc",
)

# Метрики Prometheus (до прочих middleware — корректный учёт latency)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# Security middleware (порядок важен — сначала безопасность)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    # Vercel, GitHub Pages, Render, Cloudflare quick tunnels
    allow_origin_regex=r"https://.*\.(trycloudflare\.com|vercel\.app|github\.io|onrender\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if USE_LOCAL_DOCS:
    app.mount(
        "/static/swagger-ui",
        StaticFiles(directory=str(_STATIC_SWAGGER)),
        name="swagger_ui_static",
    )
    app.mount(
        "/static/redoc",
        StaticFiles(directory=str(_STATIC_REDOC)),
        name="redoc_static",
    )

    @app.get("/docs", include_in_schema=False)
    async def swagger_ui_html():
        return get_swagger_ui_html(
            openapi_url="/openapi.json",
            title=f"{settings.APP_NAME} - Swagger UI",
            swagger_js_url="/static/swagger-ui/swagger-ui-bundle.js",
            swagger_css_url="/static/swagger-ui/swagger-ui.css",
            swagger_favicon_url="/static/swagger-ui/favicon-32x32.png",
        )

    @app.get("/redoc", include_in_schema=False)
    async def redoc_html():
        return get_redoc_html(
            openapi_url="/openapi.json",
            title=f"{settings.APP_NAME} - ReDoc",
            redoc_js_url="/static/redoc/redoc.standalone.js",
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


@app.get("/", tags=["system"])
async def root():
    """Корень — подсказка для проверки деплоя (Render/Vercel открывают именно /)."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_assets": "static" if USE_LOCAL_DOCS else "cdn",
        "health": "/health",
        "docs": "/docs",
        "api": "/api/v1",
    }


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/api/v1/health", tags=["system"])
async def api_health():
    return {"status": "ok"}
