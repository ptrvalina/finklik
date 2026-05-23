"""Ежемесячная амортизация ОС."""

from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.bootstrap import get_event_store
from app.events.constants import EV_AMORTIZATION_GENERATED
from app.models.accounting import AmortizationEntry, FixedAsset
from app.services.chart_account_service import post_ledger_entry


def _monthly_amount(asset: FixedAsset) -> Decimal:
    depreciable = asset.purchase_amount - asset.salvage_value
    if asset.useful_life_months <= 0 or depreciable <= 0:
        return Decimal("0")
    if asset.depreciation_method == "declining_balance":
        return (depreciable * Decimal("0.2")).quantize(Decimal("0.01"))
    return (depreciable / Decimal(asset.useful_life_months)).quantize(Decimal("0.01"))


async def run_monthly_amortization(
    db: AsyncSession,
    organization_id: str,
    *,
    year: int,
    month: int,
    actor: str = "system",
) -> list[AmortizationEntry]:
    last_day = monthrange(year, month)[1]
    period_end = date(year, month, last_day)
    assets = list(
        (
            await db.execute(
                select(FixedAsset).where(
                    FixedAsset.organization_id == organization_id,
                    FixedAsset.is_active.is_(True),
                    FixedAsset.purchase_date <= period_end,
                )
            )
        ).scalars().all()
    )
    created: list[AmortizationEntry] = []
    store = get_event_store()
    for asset in assets:
        dup = await db.execute(
            select(AmortizationEntry.id).where(
                AmortizationEntry.fixed_asset_id == asset.id,
                AmortizationEntry.period_year == year,
                AmortizationEntry.period_month == month,
            )
        )
        if dup.scalar_one_or_none():
            continue
        amount = _monthly_amount(asset)
        if amount <= 0:
            continue
        entry = await post_ledger_entry(
            db,
            organization_id,
            entry_date=period_end,
            debit_account="26",
            credit_account=asset.depreciation_account,
            amount=amount,
            description=f"Амортизация {asset.name} ({asset.inventory_number})",
            source_type="amortization",
            source_id=asset.id,
            actor=actor,
        )
        row = AmortizationEntry(
            organization_id=organization_id,
            fixed_asset_id=asset.id,
            period_year=year,
            period_month=month,
            amount=amount,
            ledger_entry_id=entry.id,
        )
        db.add(row)
        await db.flush()
        await store.append(
            db,
            organization_id=organization_id,
            event_type=EV_AMORTIZATION_GENERATED,
            actor=actor,
            target_id=row.id,
            target_kind="amortization_entry",
            payload={"asset_id": asset.id, "amount": str(amount), "period": f"{year}-{month:02d}"},
            idempotency_key=f"Amortization:{asset.id}:{year}-{month:02d}"[:128],
        )
        created.append(row)
    return created
