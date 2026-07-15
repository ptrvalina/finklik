"""Проверки готовности при старте API."""

from __future__ import annotations

import json
from pathlib import Path

import structlog
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import settings

log = structlog.get_logger()
_DATA = Path(__file__).resolve().parent.parent / "data"


async def run_startup_checks(engine: AsyncEngine) -> dict:
    results: dict[str, str] = {}
    ok = True

    # Env
    if not settings.DEBUG:
        if settings.JWT_SECRET_KEY.startswith("dev_"):
            results["jwt_secret"] = "WARN: default dev secret"
            ok = False
        else:
            results["jwt_secret"] = "OK"
    else:
        results["jwt_secret"] = "SKIP (debug)"

    # Chart JSON
    chart_path = _DATA / "chart_of_accounts_rb.json"
    if chart_path.is_file():
        data = json.loads(chart_path.read_text(encoding="utf-8"))
        n = len(data.get("accounts", []))
        results["chart_seed"] = f"OK ({n} accounts)"
    else:
        results["chart_seed"] = "FAIL: missing file"
        ok = False

    oked_path = _DATA / "oked_seed_popular.json"
    results["oked_seed"] = "OK" if oked_path.is_file() else "WARN: missing popular OKED seed"

    # DB schema touch
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            insp = await conn.run_sync(lambda sync_conn: inspect(sync_conn))
            tables = set(insp.get_table_names())
            required = {"organizations", "users", "chart_accounts", "ledger_entries", "domain_events"}
            missing = required - tables
            if missing:
                results["db_schema"] = f"WARN: missing tables {sorted(missing)}"
            else:
                results["db_schema"] = "OK"
            if "scanned_documents" in tables:
                cols = {c["name"] for c in insp.get_columns("scanned_documents")}
                scanner_cols = {"requires_review", "field_confidence_json", "lifecycle_status"}
                missing_scanner = scanner_cols - cols
                if missing_scanner:
                    results["scanner_schema"] = f"FAIL: missing columns {sorted(missing_scanner)}"
                    ok = False
                else:
                    results["scanner_schema"] = "OK"
    except Exception as exc:
        results["db_schema"] = f"FAIL: {exc}"
        ok = False

    results["redis"] = "SKIP (optional)"

    results["overall"] = "OK" if ok else "DEGRADED"
    log.info("startup_checks_complete", **results)
    return {"ok": ok, "checks": results}
