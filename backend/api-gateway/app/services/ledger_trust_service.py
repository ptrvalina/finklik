"""Проверки доверия к ledger для бухгалтеров."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.accounting_reports_service import trial_balance
from app.services.integrity_service import run_integrity_checks


@dataclass
class LedgerTrustReport:
    ok: bool
    checks: list[dict] = field(default_factory=list)

    def add(self, name: str, ok: bool, detail: str = "") -> None:
        self.checks.append({"name": name, "ok": ok, "detail": detail})
        if not ok:
            self.ok = False


async def verify_trial_balance_consistency(
    db: AsyncSession,
    organization_id: str,
    *,
    date_from: date,
    date_to: date,
) -> dict:
    tb = await trial_balance(db, organization_id, date_from=date_from, date_to=date_to)
    imbalance_accounts: list[str] = []
    for line in tb.get("lines", []):
        deb = Decimal(line.get("debit_turnover") or "0")
        cred = Decimal(line.get("credit_turnover") or "0")
        bal_d = Decimal(line.get("balance_debit") or "0")
        bal_c = Decimal(line.get("balance_credit") or "0")
        if deb + cred > 0 and bal_d > 0 and bal_c > 0:
            imbalance_accounts.append(line.get("account", "?"))
    return {
        "balanced": len(imbalance_accounts) == 0,
        "suspicious_accounts": imbalance_accounts,
        "line_count": len(tb.get("lines", [])),
    }


async def run_ledger_trust_suite(
    db: AsyncSession,
    organization_id: str,
    *,
    period_end: date | None = None,
) -> LedgerTrustReport:
    report = LedgerTrustReport(ok=True)
    integrity = await run_integrity_checks(db, organization_id)
    report.add("integrity", integrity.ok, f"{len(integrity.checks)} checks")
    if period_end:
        period_start = period_end.replace(day=1)
        tb = await verify_trial_balance_consistency(
            db, organization_id, date_from=period_start, date_to=period_end
        )
        report.add(
            "trial_balance_shape",
            tb["balanced"],
            f"suspicious={tb.get('suspicious_accounts', [])}",
        )
    return report
