"""Billing: plans, subscription status, limits enforcement."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, Organization
from app.models.subscription import Plan, Subscription
from app.models.transaction import Transaction
from app.models.employee import Employee
from app.models.counterparty import Counterparty

router = APIRouter(prefix="/billing", tags=["billing"])

DEFAULT_PLANS = [
    {
        "code": "free",
        "name": "Бесплатный",
        "price_byn": 0,
        "max_transactions": 50,
        "max_employees": 1,
        "max_users": 2,
        "max_counterparties": 10,
        "has_reports": False,
        "has_bank_integration": False,
        "has_ai_assistant": False,
    },
    {
        "code": "ip_start",
        "name": "ИП Старт",
        "price_byn": 2900,
        "max_transactions": 500,
        "max_employees": 5,
        "max_users": 2,
        "max_counterparties": 50,
        "has_reports": True,
        "has_bank_integration": False,
        "has_ai_assistant": True,
    },
    {
        "code": "ooo_base",
        "name": "ООО Базовый",
        "price_byn": 5900,
        "max_transactions": 2000,
        "max_employees": 20,
        "max_users": 3,
        "max_counterparties": 200,
        "has_reports": True,
        "has_bank_integration": True,
        "has_ai_assistant": True,
    },
    {
        "code": "pro_vat",
        "name": "Про (с НДС)",
        "price_byn": 9900,
        "max_transactions": 10000,
        "max_employees": 100,
        "max_users": 5,
        "max_counterparties": 1000,
        "has_reports": True,
        "has_bank_integration": True,
        "has_ai_assistant": True,
    },
]


async def _ensure_plans(db: AsyncSession) -> None:
    result = await db.execute(select(func.count(Plan.id)))
    if (result.scalar() or 0) > 0:
        return
    for p in DEFAULT_PLANS:
        db.add(Plan(**p))
    await db.flush()


async def get_org_subscription(db: AsyncSession, org_id: str) -> tuple[Subscription | None, Plan | None]:
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id).order_by(Subscription.created_at.desc())
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return None, None
    plan_r = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
    return sub, plan_r.scalar_one_or_none()


async def ensure_subscription(db: AsyncSession, org_id: str) -> Subscription:
    """Create a free trial subscription if none exists."""
    sub, _ = await get_org_subscription(db, org_id)
    if sub:
        return sub
    await _ensure_plans(db)
    free_plan = await db.execute(select(Plan).where(Plan.code == "free"))
    plan = free_plan.scalar_one_or_none()
    if not plan:
        raise HTTPException(500, "Планы не инициализированы")
    sub = Subscription(
        organization_id=org_id,
        plan_id=plan.id,
        status="trial",
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14),
    )
    db.add(sub)
    await db.flush()
    return sub


@router.get("/plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    await _ensure_plans(db)
    result = await db.execute(select(Plan).where(Plan.is_active == True).order_by(Plan.price_byn))
    plans = result.scalars().all()
    return {
        "plans": [
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "price_byn": p.price_byn,
                "max_transactions": p.max_transactions,
                "max_employees": p.max_employees,
                "max_users": p.max_users,
                "max_counterparties": p.max_counterparties,
                "has_reports": p.has_reports,
                "has_bank_integration": p.has_bank_integration,
                "has_ai_assistant": p.has_ai_assistant,
            }
            for p in plans
        ]
    }


@router.get("/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    sub = await ensure_subscription(db, org_id)
    _, plan = await get_org_subscription(db, org_id)

    tx_count = (await db.execute(
        select(func.count(Transaction.id)).where(Transaction.organization_id == org_id)
    )).scalar() or 0
    emp_count = (await db.execute(
        select(func.count(Employee.id)).where(Employee.organization_id == org_id)
    )).scalar() or 0
    cp_count = (await db.execute(
        select(func.count(Counterparty.id)).where(Counterparty.organization_id == org_id)
    )).scalar() or 0

    return {
        "subscription": {
            "id": sub.id,
            "status": sub.status,
            "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
            "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        },
        "plan": {
            "code": plan.code if plan else "free",
            "name": plan.name if plan else "Бесплатный",
            "price_byn": plan.price_byn if plan else 0,
            "max_transactions": plan.max_transactions if plan else 50,
            "max_employees": plan.max_employees if plan else 1,
            "max_users": plan.max_users if plan else 2,
            "max_counterparties": plan.max_counterparties if plan else 10,
            "has_reports": plan.has_reports if plan else False,
            "has_bank_integration": plan.has_bank_integration if plan else False,
            "has_ai_assistant": plan.has_ai_assistant if plan else False,
        },
        "usage": {
            "transactions": tx_count,
            "employees": emp_count,
            "counterparties": cp_count,
        },
    }


@router.post("/change-plan")
async def change_plan(
    plan_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "owner":
        raise HTTPException(403, "Только владелец может менять тариф")

    plan_result = await db.execute(select(Plan).where(Plan.code == plan_code, Plan.is_active == True))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Тариф не найден")

    org_id = current_user.organization_id
    sub, _ = await get_org_subscription(db, org_id)
    if not sub:
        sub = await ensure_subscription(db, org_id)

    sub.plan_id = plan.id
    sub.status = "active" if plan.price_byn == 0 else "active"
    sub.current_period_start = datetime.now(timezone.utc)
    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)

    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    if org:
        org.max_users = plan.max_users

    await db.flush()
    return {"ok": True, "plan": plan.code, "message": f"Тариф изменён на «{plan.name}»"}
