"""Проверка согласованности производного FinancialState с аудитом (Flow 10)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.state_audit import FinancialStateAuditEntry
from app.schemas.financial_state import FinancialState
from app.schemas.flow10_trust import StateConsistencyPlain
from app.services.state_truth_governance_service import financial_state_fingerprint


async def evaluate_state_consistency_plain(
    db: AsyncSession,
    organization_id: str,
    fs: FinancialState,
) -> StateConsistencyPlain:
    fp = financial_state_fingerprint(fs)
    r = await db.execute(
        select(FinancialStateAuditEntry)
        .where(FinancialStateAuditEntry.organization_id == organization_id)
        .order_by(FinancialStateAuditEntry.created_at.desc())
        .limit(1)
    )
    last = r.scalar_one_or_none()

    derived = fs.derived_at
    derived_aware = derived.replace(tzinfo=timezone.utc) if derived.tzinfo is None else derived
    age = datetime.now(timezone.utc) - derived_aware
    stale_hint = None
    if age > timedelta(minutes=12):
        stale_hint = "Снимок обновлён чуть раньше; при активных правках стоит обновить экран, чтобы увидеть последнюю картину."

    if last is None:
        return StateConsistencyPlain(
            snapshot_aligned_with_audit=False,
            message_plain="Первая фиксация состояния в аудите появится после следующего сохранённого пересчёта.",
            stale_hint_plain=stale_hint,
        )

    aligned = last.state_fingerprint == fp
    if aligned:
        msg = "Снимок согласован с последней зафиксированной версией в журнале изменений."
    else:
        msg = "Снимок пересчитан; запись аудита обновится при следующей фиксации — это нормально при свежих правках."

    return StateConsistencyPlain(
        snapshot_aligned_with_audit=aligned,
        message_plain=msg,
        stale_hint_plain=stale_hint,
    )
