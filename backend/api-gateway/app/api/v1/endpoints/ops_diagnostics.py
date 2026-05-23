"""Операционная диагностика (admin)."""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import engine, get_db
from app.core.deps import require_roles
from app.models.document import ScannedDocument
from app.models.user import User
from app.services.integrity_service import run_integrity_checks
from app.services.startup_checks import run_startup_checks

router = APIRouter(prefix="/ops", tags=["ops"])


async def _verify_ops_access(
    current_user: User = Depends(require_roles("admin")),
    x_finklik_ops_token: str | None = Header(default=None, alias="X-Finklik-Ops-Token"),
) -> User:
    token = (settings.PROVISION_ADMIN_TOKEN or "").strip()
    if token and x_finklik_ops_token == token:
        return current_user
    if current_user:
        return current_user
    raise HTTPException(403, "Недостаточно прав")


@router.get("/diagnostics")
async def ops_diagnostics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_verify_ops_access),
):
    _ = current_user
    startup = await run_startup_checks(engine)
    integrity = await run_integrity_checks(db)

    ocr_pending = (
        await db.execute(
            select(func.count()).select_from(ScannedDocument).where(ScannedDocument.status == "needs_review")
        )
    ).scalar_one()

    from app.services.ledger_trust_service import run_ledger_trust_suite
    from datetime import date

    ledger_trust = None
    try:
        oid = getattr(current_user, "organization_id", None)
        if oid:
            lt = await run_ledger_trust_suite(db, oid, period_end=date.today())
            ledger_trust = {"ok": lt.ok, "checks": lt.checks}
    except Exception:
        ledger_trust = None

    return {
        "startup": startup,
        "integrity": {"ok": integrity.ok, "checks": integrity.checks},
        "ledger_trust": ledger_trust,
        "ocr": {"needs_review_queue": ocr_pending},
        "sync": {"note": "See GET /api/v1/automation/health for 1C sync SLA"},
        "queues": {"note": "In-process workers; scrape /metrics for finclick_job_*"},
        "reporting": {"async_submit": getattr(settings, "SUBMISSION_ASYNC", False)},
    }
