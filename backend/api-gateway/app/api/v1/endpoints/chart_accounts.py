"""План счетов, субсчета, проводки, ОС, амортизация."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.models.accounting import AmortizationEntry, ChartAccount, ChartSubaccount, FixedAsset, LedgerEntry
from app.models.user import Organization, User
from app.services.amortization_service import run_monthly_amortization
from app.services.chart_account_service import (
    create_subaccount,
    list_chart_accounts,
    list_subaccounts,
    post_ledger_entry,
    seed_chart_accounts_if_empty,
    seed_official_subaccounts_for_org,
)
from app.services.ledger_engine import validate_posting
from app.services.period_close_service import close_period
from app.services.ledger_engine import create_reversal_entry
from app.services.ledger_trust_service import run_ledger_trust_suite
from app.services.oked_context_service import get_organization_oked_hints

router = APIRouter(prefix="/accounting", tags=["accounting"])


class ChartAccountOut(BaseModel):
    code: str
    name_ru: str
    account_class: int
    balance_type: str
    is_off_balance: bool


class SubaccountCreate(BaseModel):
    parent_account_code: str
    suffix: str = Field(min_length=1, max_length=16)
    name_ru: str = Field(min_length=1, max_length=255)
    parent_id: str | None = None


class SubaccountOut(BaseModel):
    id: str
    full_code: str
    name_ru: str
    parent_account_code: str
    is_archived: bool


class LedgerPost(BaseModel):
    entry_date: date
    debit_account: str
    credit_account: str
    amount: Decimal = Field(gt=0)
    vat_amount: Decimal | None = Field(default=None, ge=0)
    description: str | None = None
    analytics: dict | None = None


class FixedAssetCreate(BaseModel):
    inventory_number: str
    name: str
    purchase_date: date
    purchase_amount: Decimal = Field(gt=0)
    useful_life_months: int = Field(ge=1, le=600)
    depreciation_method: str = "straight_line"
    salvage_value: Decimal = Field(default=Decimal("0"), ge=0)


class FixedAssetPatch(BaseModel):
    is_active: bool | None = None


class AccountingModePatch(BaseModel):
    accounting_mode: str = Field(pattern="^(simple|advanced)$")


@router.get("/chart", response_model=list[ChartAccountOut])
async def get_chart(
    include_off_balance: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    rows = await list_chart_accounts(db, include_off_balance=include_off_balance)
    return [
        ChartAccountOut(
            code=r.code,
            name_ru=r.name_ru,
            account_class=r.account_class,
            balance_type=r.balance_type,
            is_off_balance=r.is_off_balance,
        )
        for r in rows
    ]


@router.get("/chart/tree")
async def get_chart_tree(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    oid = workspace_organization_id(current_user)
    await seed_chart_accounts_if_empty(db)
    await seed_official_subaccounts_for_org(db, oid)
    accounts = await list_chart_accounts(db)
    subs = await list_subaccounts(db, oid)
    by_parent: dict[str, list] = {}
    for s in subs:
        by_parent.setdefault(s.parent_account_code, []).append(
            {"id": s.id, "full_code": s.full_code, "name_ru": s.name_ru}
        )
    classes: dict[int, list] = {}
    for a in accounts:
        classes.setdefault(a.account_class, []).append(
            {
                "code": a.code,
                "name_ru": a.name_ru,
                "is_off_balance": a.is_off_balance,
                "subaccounts": by_parent.get(a.code, []),
            }
        )
    return {"classes": [{"id": k, "accounts": v} for k, v in sorted(classes.items())]}


@router.post("/subaccounts", response_model=SubaccountOut, status_code=201)
async def add_subaccount(
    body: SubaccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    acc = await db.get(ChartAccount, body.parent_account_code)
    if not acc:
        raise HTTPException(404, "Синтетический счёт не найден")
    sub = await create_subaccount(
        db,
        oid,
        parent_account_code=body.parent_account_code,
        suffix=body.suffix,
        name_ru=body.name_ru,
        parent_id=body.parent_id,
        actor=str(current_user.id),
    )
    await db.commit()
    return SubaccountOut(
        id=sub.id,
        full_code=sub.full_code,
        name_ru=sub.name_ru,
        parent_account_code=sub.parent_account_code,
        is_archived=sub.is_archived,
    )


@router.post("/subaccounts/seed-official")
async def seed_official_subaccounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    n = await seed_official_subaccounts_for_org(db, oid)
    await db.commit()
    return {"created": n}


@router.post("/ledger/preview")
async def preview_ledger_entry(
    body: LedgerPost,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    preview = await validate_posting(
        db,
        oid,
        entry_date=body.entry_date,
        debit_account=body.debit_account,
        credit_account=body.credit_account,
        amount=body.amount,
        vat_amount=body.vat_amount,
    )
    return {
        "valid": preview.valid,
        "errors": preview.errors,
        "debit_account": preview.debit_account,
        "credit_account": preview.credit_account,
        "amount": str(preview.amount),
        "vat_amount": str(preview.vat_amount) if preview.vat_amount is not None else None,
    }


@router.post("/periods/{year}/{month}/close")
async def close_accounting_period(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Только владелец может закрывать период")
    oid = workspace_organization_id(current_user)
    period = await close_period(db, oid, year=year, month=month, closed_by=str(current_user.id))
    await db.commit()
    return {"year": period.year, "month": period.month, "status": period.status}


@router.post("/ledger", status_code=201)
async def create_ledger_entry(
    body: LedgerPost,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    org = await db.get(Organization, oid)
    if not org or org.accounting_mode != "advanced":
        raise HTTPException(403, "Проводки доступны в расширенном режиме учёта")
    entry = await post_ledger_entry(
        db,
        oid,
        entry_date=body.entry_date,
        debit_account=body.debit_account,
        credit_account=body.credit_account,
        amount=body.amount,
        vat_amount=body.vat_amount,
        description=body.description,
        analytics=body.analytics,
        created_by=current_user.id,
        actor=str(current_user.id),
    )
    await db.commit()
    return {"id": entry.id}


@router.get("/ledger")
async def list_ledger(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    rows = (
        await db.execute(
            select(LedgerEntry)
            .where(LedgerEntry.organization_id == oid)
            .order_by(LedgerEntry.entry_date.desc())
            .limit(limit)
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": r.id,
                "entry_date": r.entry_date.isoformat(),
                "debit_account": r.debit_account,
                "credit_account": r.credit_account,
                "amount": str(r.amount),
                "description": r.description,
            }
            for r in rows
        ]
    }


@router.get("/fixed-assets")
async def list_fixed_assets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    rows = (
        await db.execute(
            select(FixedAsset)
            .where(FixedAsset.organization_id == oid)
            .order_by(FixedAsset.purchase_date.desc())
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": a.id,
                "inventory_number": a.inventory_number,
                "name": a.name,
                "purchase_date": a.purchase_date.isoformat(),
                "purchase_amount": str(a.purchase_amount),
                "useful_life_months": a.useful_life_months,
                "depreciation_method": a.depreciation_method,
                "salvage_value": str(a.salvage_value),
                "asset_account": a.asset_account,
                "depreciation_account": a.depreciation_account,
                "is_active": a.is_active,
            }
            for a in rows
        ]
    }


@router.post("/fixed-assets", status_code=201)
async def create_fixed_asset(
    body: FixedAssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    asset = FixedAsset(
        organization_id=oid,
        inventory_number=body.inventory_number,
        name=body.name,
        purchase_date=body.purchase_date,
        purchase_amount=body.purchase_amount,
        useful_life_months=body.useful_life_months,
        depreciation_method=body.depreciation_method,
        salvage_value=body.salvage_value,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return {"id": asset.id}


@router.patch("/fixed-assets/{asset_id}")
async def patch_fixed_asset(
    asset_id: str,
    body: FixedAssetPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    asset = await db.get(FixedAsset, asset_id)
    if not asset or asset.organization_id != oid:
        raise HTTPException(404, "Основное средство не найдено")
    if body.is_active is not None:
        asset.is_active = body.is_active
    await db.commit()
    return {"id": asset.id, "is_active": asset.is_active}


@router.get("/amortization")
async def list_amortization(
    limit: int = Query(48, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    rows = (
        await db.execute(
            select(AmortizationEntry)
            .where(AmortizationEntry.organization_id == oid)
            .order_by(
                AmortizationEntry.period_year.desc(),
                AmortizationEntry.period_month.desc(),
            )
            .limit(limit)
        )
    ).scalars().all()
    asset_ids = {r.fixed_asset_id for r in rows}
    names: dict[str, str] = {}
    if asset_ids:
        assets = (
            await db.execute(select(FixedAsset).where(FixedAsset.id.in_(asset_ids)))
        ).scalars().all()
        names = {a.id: a.name for a in assets}
    return {
        "items": [
            {
                "id": r.id,
                "fixed_asset_id": r.fixed_asset_id,
                "asset_name": names.get(r.fixed_asset_id, ""),
                "period_year": r.period_year,
                "period_month": r.period_month,
                "amount": str(r.amount),
                "ledger_entry_id": r.ledger_entry_id,
            }
            for r in rows
        ]
    }


@router.post("/amortization/run")
async def amortization_run(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    created = await run_monthly_amortization(db, oid, year=year, month=month, actor=str(current_user.id))
    await db.commit()
    return {"created": len(created)}


@router.get("/trust")
async def ledger_trust(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    from datetime import date

    oid = workspace_organization_id(current_user)
    report = await run_ledger_trust_suite(db, oid, period_end=date.today())
    return {"ok": report.ok, "checks": report.checks}


@router.post("/ledger/{entry_id}/reverse", status_code=201)
async def reverse_ledger_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    entry = await db.get(LedgerEntry, entry_id)
    if not entry or entry.organization_id != oid:
        raise HTTPException(404, "Проводка не найдена")
    rev = await create_reversal_entry(db, oid, entry, actor=str(current_user.id))
    await db.commit()
    return {"id": rev.id, "reversal_of": entry_id}


@router.get("/oked-context")
async def oked_context(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    oid = workspace_organization_id(current_user)
    return await get_organization_oked_hints(db, oid)


@router.get("/mode")
async def get_accounting_mode(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    oid = workspace_organization_id(current_user)
    org = await db.get(Organization, oid)
    if not org:
        raise HTTPException(404, "Организация не найдена")
    return {"accounting_mode": org.accounting_mode or "simple"}


@router.patch("/mode")
async def patch_accounting_mode(
    body: AccountingModePatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Только владелец может менять режим учёта")
    oid = workspace_organization_id(current_user)
    org = await db.get(Organization, oid)
    if not org:
        raise HTTPException(404, "Организация не найдена")
    org.accounting_mode = body.accounting_mode
    await db.commit()
    return {"accounting_mode": org.accounting_mode}
