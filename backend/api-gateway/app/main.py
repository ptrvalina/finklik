from pathlib import Path
import asyncio

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import structlog

from app.core.config import settings
from app.core.cors import cors_middleware_kwargs
from app.core.database import engine, Base, get_db
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
from app.api.v1.endpoints.onec_contour import router as onec_contour_router
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.import_data import router as import_router
from app.api.v1.endpoints.demo import router as demo_router
from app.api.v1.endpoints.team import router as team_router
from app.api.v1.endpoints.regulatory import router as regulatory_router
from app.api.v1.endpoints.report_submission import router as submission_router
from app.api.v1.endpoints.assistant import router as assistant_router
from app.api.v1.endpoints.billing import router as billing_router
from app.api.v1.endpoints.primary_documents import router as primary_documents_router
from app.api.v1.endpoints.fx_nbrb import router as fx_nbrb_router
from app.api.v1.endpoints.workforce import router as workforce_router
from app.websocket.router import router as ws_router
from app.security.middleware import SecurityHeadersMiddleware, RateLimitMiddleware, JwtQueryParamBlockMiddleware
from app.services.onec_sync_service import process_onec_sync_jobs_forever
from app.services.nbrb_fx_service import start_nbrb_background_loop, stop_nbrb_background_loop
from prometheus_fastapi_instrumentator import Instrumentator

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer() if not settings.DEBUG else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(0),
    context_class=dict,
    # stdlib processors (e.g. add_logger_name) require stdlib logger objects.
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)
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
    if not settings.DEBUG:
        if settings.JWT_SECRET_KEY.startswith("dev_") or "min32chars" in settings.JWT_SECRET_KEY:
            log.warning(
                "security_jwt_secret_default",
                hint="Задайте JWT_SECRET_KEY и JWT_REFRESH_SECRET_KEY в окружении production.",
            )
        if settings.JWT_REFRESH_SECRET_KEY.startswith("dev_"):
            log.warning("security_jwt_refresh_default")
    log.info(
        "cors_ready",
        origins=len(settings.cors_origins),
        regex=bool(settings.cors_origin_regex_effective),
        preflight_max_age=settings.CORS_PREFLIGHT_MAX_AGE,
        trusted_hosts=len(settings.allowed_hosts),
        refresh_cookie_samesite=settings.REFRESH_COOKIE_SAMESITE,
    )
    sync_poller_task: asyncio.Task | None = None
    nbrb_task = start_nbrb_background_loop()
    if nbrb_task:
        log.info("nbrb_fx_background_started", interval_sec=settings.NBRB_FX_REFRESH_SECONDS)
    max_attempts = 5
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            log.info("db_startup_ready", attempt=attempt)
            # Render free plan fallback: run 1C sync poller in API process.
            sync_poller_task = asyncio.create_task(process_onec_sync_jobs_forever())
            log.info("onec_sync_poller_started", mode="in_process")
            break
        except Exception as exc:
            if attempt == max_attempts:
                log.error(
                    "db_startup_unavailable",
                    attempts=max_attempts,
                    error=str(exc),
                )
                # Не валим процесс: сервис должен подниматься и отдавать health=degraded.
                break
            log.warning("db_startup_retry", attempt=attempt, error=str(exc))
            await asyncio.sleep(2)
    yield
    await stop_nbrb_background_loop()
    if sync_poller_task:
        sync_poller_task.cancel()
        try:
            await sync_poller_task
        except asyncio.CancelledError:
            pass
    await engine.dispose()
    log.info("shutdown")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url=None if USE_LOCAL_DOCS else "/docs",
    redoc_url=None if USE_LOCAL_DOCS else "/redoc",
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    log.error("unhandled_exception", path=request.url.path, error=str(exc), exc_info=True)
    from starlette.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal error: {type(exc).__name__}: {exc}"},
    )

# Метрики Prometheus (до прочих middleware — корректный учёт latency)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# Security middleware (порядок важен — сначала безопасность)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    **cors_middleware_kwargs(
        origins=list(settings.cors_origins),
        origin_regex=settings.cors_origin_regex_effective,
        max_age=settings.CORS_PREFLIGHT_MAX_AGE,
    ),
)
if settings.allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
# Последним в цепочке add_middleware → первым на входящий запрос: блокировать JWT в query ASAP.
app.add_middleware(JwtQueryParamBlockMiddleware)

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
app.include_router(onec_contour_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(import_router, prefix="/api/v1")
app.include_router(demo_router, prefix="/api/v1")
app.include_router(team_router, prefix="/api/v1")
app.include_router(regulatory_router, prefix="/api/v1")
app.include_router(submission_router, prefix="/api/v1")
app.include_router(assistant_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(primary_documents_router, prefix="/api/v1")
app.include_router(fx_nbrb_router, prefix="/api/v1")
app.include_router(workforce_router, prefix="/api/v1")
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
async def health(db: AsyncSession = Depends(get_db)):
    checks: dict = {"service": settings.APP_NAME, "version": settings.APP_VERSION}
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as exc:
        checks["db"] = f"error: {exc}"

    try:
        from app.cache.redis_cache import cache as _cache
        client = await _cache.get_client()
        checks["redis"] = "ok" if client else "unavailable"
    except Exception:
        checks["redis"] = "unavailable"

    overall = "ok" if checks.get("db") == "ok" else "degraded"
    return {"status": overall, **checks}


@app.get("/api/v1/health", tags=["system"])
async def api_health():
    return {"status": "ok"}
