"""План счетов РБ: загрузка, субсчета, проводки."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.bootstrap import get_event_store
from app.events.constants import EV_ACCOUNT_CREATED, EV_SUBACCOUNT_CREATED
from app.models.accounting import ChartAccount, ChartSubaccount, LedgerEntry

_DATA = Path(__file__).resolve().parent.parent / "data" / "chart_of_accounts_rb.json"


async def seed_chart_accounts_if_empty(db: AsyncSession) -> int:
    existing = await db.execute(select(ChartAccount.code).limit(1))
    if existing.scalar_one_or_none():
        return 0
    payload = json.loads(_DATA.read_text(encoding="utf-8"))
    n = 0
    for row in payload.get("accounts", []):
        db.add(
            ChartAccount(
                code=str(row["code"]),
                name_ru=str(row["name"]),
                account_class=int(row["class"]),
                balance_type=str(row.get("type", "active")),
                is_off_balance=bool(row.get("off_balance", False)),
                is_system=True,
            )
        )
        n += 1
    await db.flush()
    return n


async def list_chart_accounts(db: AsyncSession, *, include_off_balance: bool = True) -> list[ChartAccount]:
    await seed_chart_accounts_if_empty(db)
    stmt = select(ChartAccount).order_by(ChartAccount.account_class, ChartAccount.code)
    if not include_off_balance:
        stmt = stmt.where(ChartAccount.is_off_balance.is_(False))
    return list((await db.execute(stmt)).scalars().all())


async def list_subaccounts(db: AsyncSession, organization_id: str, parent_code: str | None = None) -> list[ChartSubaccount]:
    stmt = select(ChartSubaccount).where(
        ChartSubaccount.organization_id == organization_id,
        ChartSubaccount.is_archived.is_(False),
    )
    if parent_code:
        stmt = stmt.where(ChartSubaccount.parent_account_code == parent_code)
    stmt = stmt.order_by(ChartSubaccount.full_code)
    return list((await db.execute(stmt)).scalars().all())


async def create_subaccount(
    db: AsyncSession,
    organization_id: str,
    *,
    parent_account_code: str,
    suffix: str,
    name_ru: str,
    parent_id: str | None = None,
    actor: str = "user",
) -> ChartSubaccount:
    full_code = f"{parent_account_code}.{suffix.strip()}"
    sub = ChartSubaccount(
        organization_id=organization_id,
        parent_account_code=parent_account_code,
        parent_id=parent_id,
        full_code=full_code,
        name_ru=name_ru.strip(),
    )
    db.add(sub)
    await db.flush()
    store = get_event_store()
    await store.append(
        db,
        organization_id=organization_id,
        event_type=EV_SUBACCOUNT_CREATED,
        actor=actor,
        target_id=sub.id,
        target_kind="chart_subaccount",
        payload={"full_code": full_code, "name_ru": name_ru},
        idempotency_key=f"SubaccountCreated:{organization_id}:{full_code}"[:128],
    )
    return sub


async def post_ledger_entry(
    db: AsyncSession,
    organization_id: str,
    *,
    entry_date,
    debit_account: str,
    credit_account: str,
    amount: Decimal,
    description: str | None = None,
    analytics: dict | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
    created_by: str | None = None,
    actor: str = "user",
) -> LedgerEntry:
    from app.events.constants import EV_ACCOUNT_CREATED  # ledger uses AccountCreated as journal posted

    entry = LedgerEntry(
        organization_id=organization_id,
        entry_date=entry_date,
        debit_account=debit_account,
        credit_account=credit_account,
        amount=amount,
        description=description,
        analytics_json=json.dumps(analytics, ensure_ascii=False) if analytics else None,
        source_type=source_type,
        source_id=source_id,
        created_by=created_by,
    )
    db.add(entry)
    await db.flush()
    store = get_event_store()
    await store.append(
        db,
        organization_id=organization_id,
        event_type=EV_ACCOUNT_CREATED,
        actor=actor,
        target_id=entry.id,
        target_kind="ledger_entry",
        payload={
            "debit": debit_account,
            "credit": credit_account,
            "amount": str(amount),
        },
        idempotency_key=f"LedgerEntry:{entry.id}"[:128],
    )
    return entry
