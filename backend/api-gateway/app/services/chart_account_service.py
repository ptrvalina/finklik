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
_SUBACCOUNTS_OFFICIAL = Path(__file__).resolve().parent.parent / "data" / "chart_subaccounts_official_rb.json"
_CATALOG_VERSION = "2026-05-23-full"


def _normal_balance_from_type(balance_type: str) -> str | None:
    bt = (balance_type or "").lower()
    if bt == "active":
        return "debit"
    if bt == "passive":
        return "credit"
    if bt in ("active_passive", "off_balance"):
        return "both"
    return None


def _load_chart_payload() -> dict:
    return json.loads(_DATA.read_text(encoding="utf-8"))


def _chart_row_to_model(row: dict) -> ChartAccount:
    bt = str(row.get("type", "active"))
    code = str(row["code"])
    return ChartAccount(
        code=code,
        name_ru=str(row["name"]),
        account_class=int(row["class"]),
        balance_type=bt,
        is_off_balance=bool(row.get("off_balance", False)),
        is_system=True,
        normal_balance=_normal_balance_from_type(bt),
        is_optional=bool(row.get("optional", False)),
        requires_analytics=bt == "active_passive" and code in ("60", "62", "68", "76"),
    )


async def sync_official_chart_catalog(db: AsyncSession) -> dict[str, int]:
    """Добавляет/обновляет системные счета из JSON-каталога (без удаления пользовательских)."""
    payload = _load_chart_payload()
    catalog_version = str(payload.get("meta", {}).get("version", _CATALOG_VERSION))
    by_code = {
        str(r.code): r
        for r in (await db.execute(select(ChartAccount))).scalars().all()
    }
    created = updated = 0
    for row in payload.get("accounts", []):
        code = str(row["code"])
        existing = by_code.get(code)
        if not existing:
            acc = _chart_row_to_model(row)
            db.add(acc)
            by_code[code] = acc
            created += 1
            continue
        if not existing.is_system:
            continue
        name = str(row["name"])
        account_class = int(row["class"])
        bt = str(row.get("type", "active"))
        off_balance = bool(row.get("off_balance", False))
        if (
            existing.name_ru != name
            or existing.account_class != account_class
            or existing.balance_type != bt
            or existing.is_off_balance != off_balance
        ):
            existing.name_ru = name
            existing.account_class = account_class
            existing.balance_type = bt
            existing.is_off_balance = off_balance
            existing.normal_balance = _normal_balance_from_type(bt)
            existing.requires_analytics = bt == "active_passive" and code in ("60", "62", "68", "76")
            updated += 1
    await db.flush()
    return {"version": catalog_version, "created": created, "updated": updated}


async def seed_chart_accounts_if_empty(db: AsyncSession) -> int:
    existing = await db.execute(select(ChartAccount.code).limit(1))
    if existing.scalar_one_or_none():
        synced = await sync_official_chart_catalog(db)
        return synced["created"] + synced["updated"]
    payload = _load_chart_payload()
    n = 0
    for row in payload.get("accounts", []):
        db.add(_chart_row_to_model(row))
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


async def sync_official_subaccounts_for_org(db: AsyncSession, organization_id: str) -> dict[str, int]:
    if not _SUBACCOUNTS_OFFICIAL.is_file():
        return {"created": 0, "updated": 0}
    payload = json.loads(_SUBACCOUNTS_OFFICIAL.read_text(encoding="utf-8"))
    existing_rows = (
        await db.execute(
            select(ChartSubaccount).where(
                ChartSubaccount.organization_id == organization_id,
                ChartSubaccount.is_official_template.is_(True),
            )
        )
    ).scalars().all()
    by_code = {str(s.full_code): s for s in existing_rows}
    created = updated = 0
    for row in payload.get("subaccounts", []):
        parent = str(row["parent"])
        suffix = str(row["suffix"])
        full_code = f"{parent}.{suffix}"
        name = str(row["name"])
        sub = by_code.get(full_code)
        if not sub:
            db.add(
                ChartSubaccount(
                    organization_id=organization_id,
                    parent_account_code=parent,
                    full_code=full_code,
                    name_ru=name,
                    is_official_template=True,
                )
            )
            created += 1
            continue
        if sub.name_ru != name:
            sub.name_ru = name
            updated += 1
    await db.flush()
    return {"created": created, "updated": updated}


async def seed_official_subaccounts_for_org(db: AsyncSession, organization_id: str) -> int:
    result = await sync_official_subaccounts_for_org(db, organization_id)
    return result["created"] + result["updated"]


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
    vat_amount: Decimal | None = None,
    actor: str = "user",
) -> LedgerEntry:
    from app.events.constants import EV_ACCOUNT_CREATED
    from app.services.ledger_engine import assert_posting_allowed

    await assert_posting_allowed(
        db,
        organization_id,
        entry_date=entry_date,
        debit_account=debit_account,
        credit_account=credit_account,
        amount=amount,
        vat_amount=vat_amount,
    )

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
        vat_amount=vat_amount,
        period_year=entry_date.year,
        period_month=entry_date.month,
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
