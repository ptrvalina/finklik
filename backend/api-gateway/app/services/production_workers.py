"""Фоновые циклы: целостность, амортизация."""

from __future__ import annotations

import asyncio
from datetime import date

import structlog
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.user import Organization
from app.services.amortization_service import run_monthly_amortization
from app.services.integrity_service import run_integrity_checks
from app.services.job_runner import run_with_retry

log = structlog.get_logger()

INTEGRITY_INTERVAL_SEC = 24 * 3600
AMORTIZATION_CHECK_INTERVAL_SEC = 3600


async def integrity_verification_forever() -> None:
    while True:
        await asyncio.sleep(INTEGRITY_INTERVAL_SEC)
        await run_with_retry("nightly_integrity", _run_integrity_once)


async def _run_integrity_once() -> None:
    async with AsyncSessionLocal() as db:
        report = await run_integrity_checks(db)
        await db.commit()
        if not report.ok:
            from app.security.metrics import INTEGRITY_CHECK_FAILED_TOTAL

            for c in report.checks:
                if not c.get("ok"):
                    INTEGRITY_CHECK_FAILED_TOTAL.labels(check=c.get("name", "unknown")).inc()
        log.info("integrity_nightly", ok=report.ok, checks=len(report.checks))


async def amortization_scheduler_forever() -> None:
    """1-го числа месяца — амортизация за прошлый месяц для advanced orgs."""
    while True:
        await asyncio.sleep(AMORTIZATION_CHECK_INTERVAL_SEC)
        today = date.today()
        if today.day != 1:
            continue
        if today.month == 1:
            year, month = today.year - 1, 12
        else:
            year, month = today.year, today.month - 1
        await run_with_retry(
            "monthly_amortization_all_orgs",
            lambda: _run_amortization_all(year, month),
            timeout_sec=600.0,
        )


async def _run_amortization_all(year: int, month: int) -> None:
    async with AsyncSessionLocal() as db:
        orgs = (
            await db.execute(
                select(Organization).where(Organization.accounting_mode == "advanced")
            )
        ).scalars().all()
        for org in orgs:
            try:
                await run_monthly_amortization(db, org.id, year=year, month=month, actor="scheduler")
            except Exception as exc:
                log.warning("amortization_org_failed", org_id=org.id, error=str(exc))
        await db.commit()
        log.info("amortization_scheduler_done", orgs=len(orgs), year=year, month=month)
