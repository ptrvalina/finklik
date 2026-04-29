from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from decimal import Decimal
from datetime import date, datetime, timezone
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.transaction import (
    TransactionCreate, TransactionResponse,
    PaginatedTransactions, DashboardMetrics,
)
from app.cache.redis_cache import cache

router = APIRouter(
    tags=["transactions"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


@router.get("/dashboard", response_model=DashboardMetrics)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    cache_key = cache.key_dashboard(str(org_id))
    cached = await cache.get(cache_key)
    if cached:
        return DashboardMetrics(**cached)

    now = datetime.now(timezone.utc)
    month_start = date(now.year, now.month, 1)
    quarter = (now.month - 1) // 3
    quarter_start = date(now.year, quarter * 3 + 1, 1)

    income_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == org_id,
                 Transaction.type == "income",
                 Transaction.transaction_date >= month_start)
        )
    )
    income = Decimal(str(income_q.scalar()))

    expense_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == org_id,
                 Transaction.type == "expense",
                 Transaction.transaction_date >= month_start)
        )
    )
    expense = Decimal(str(expense_q.scalar()))

    income_qq = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == org_id,
                 Transaction.type == "income",
                 Transaction.transaction_date >= quarter_start)
        )
    )
    income_quarter = Decimal(str(income_qq.scalar()))

    tax_usn = (income_quarter * Decimal("0.03")).quantize(Decimal("0.01"))
    tax_vat = (income * Decimal("0.20") / Decimal("1.20")).quantize(Decimal("0.01"))
    tax_fsszn = (income_quarter * Decimal("0.34")).quantize(Decimal("0.01"))

    count_q = await db.execute(
        select(func.count(Transaction.id)).where(
            and_(Transaction.organization_id == org_id,
                 Transaction.transaction_date >= month_start)
        )
    )
    tx_count = count_q.scalar() or 0

    # Баланс из реальных операций (как в /bank/balance), без отдельного мок-банка
    inc_all = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == org_id, Transaction.type == "income")
        )
    )
    exp_all = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == org_id,
                Transaction.type.in_(["expense", "writeoff"]),
            )
        )
    )
    bank_balance = Decimal(str(inc_all.scalar())) - Decimal(str(exp_all.scalar()))

    from app.models.document import ScannedDocument
    pending_ocr_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            and_(ScannedDocument.organization_id == org_id,
                 ScannedDocument.status.in_(["pending", "processing"]))
        )
    )
    pending_ocr = pending_ocr_q.scalar() or 0

    next_month = now.month % 12 + 1
    next_year = now.year if now.month < 12 else now.year + 1
    next_deadline = date(next_year, next_month, 22)

    result = DashboardMetrics(
        income_current_month=income,
        expense_current_month=expense,
        balance_current_month=income - expense,
        tax_usn_quarter=tax_usn,
        tax_vat_month=tax_vat,
        tax_fsszn_quarter=tax_fsszn,
        next_tax_deadline=next_deadline,
        bank_balance=bank_balance,
        transactions_this_month=tx_count,
        documents_pending_ocr=pending_ocr,
    )
    await cache.set(cache_key, result.model_dump(), ttl=300)
    return result


@router.get("/transactions", response_model=PaginatedTransactions)
async def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    search: str | None = Query(None, description="Поиск по описанию"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * per_page
    filters = [Transaction.organization_id == current_user.organization_id]
    if type:
        filters.append(Transaction.type == type)
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if search and search.strip():
        filters.append(Transaction.description.ilike(f"%{search.strip()}%"))

    total_q = await db.execute(
        select(func.count(Transaction.id)).where(and_(*filters))
    )
    total = total_q.scalar() or 0

    result = await db.execute(
        select(Transaction)
        .where(and_(*filters))
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    items = result.scalars().all()
    return PaginatedTransactions(items=list(items), total=total, page=page, per_page=per_page)


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.counterparty_id:
        from app.models.counterparty import Counterparty
        cp = await db.execute(
            select(Counterparty).where(
                Counterparty.id == body.counterparty_id,
                Counterparty.organization_id == current_user.organization_id,
            )
        )
        if not cp.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Контрагент не найден в вашей организации")

    tx = Transaction(
        organization_id=current_user.organization_id,
        type=body.type,
        amount=body.amount,
        vat_amount=body.vat_amount,
        counterparty_id=body.counterparty_id,
        category=body.category,
        description=body.description,
        source=body.source,
        ai_category_confidence=body.ai_category_confidence,
        receipt_image_url=body.receipt_image_url,
        transaction_date=body.transaction_date,
    )
    db.add(tx)
    await db.flush()
    await cache.invalidate_org(str(current_user.organization_id))
    return tx


@router.put("/transactions/{tx_id}", response_model=TransactionResponse)
async def update_transaction(
    tx_id: str,
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.organization_id == current_user.organization_id,
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Транзакция не найдена")
    if body.counterparty_id:
        from app.models.counterparty import Counterparty
        cp = await db.execute(
            select(Counterparty).where(
                Counterparty.id == body.counterparty_id,
                Counterparty.organization_id == current_user.organization_id,
            )
        )
        if not cp.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Контрагент не найден в вашей организации")

    tx.type = body.type
    tx.amount = body.amount
    tx.vat_amount = body.vat_amount
    tx.counterparty_id = body.counterparty_id
    tx.category = body.category
    tx.description = body.description
    tx.source = body.source
    tx.ai_category_confidence = body.ai_category_confidence
    tx.receipt_image_url = body.receipt_image_url
    tx.transaction_date = body.transaction_date
    await db.flush()
    await cache.invalidate_org(str(current_user.organization_id))
    return tx


@router.delete("/transactions/{tx_id}", status_code=204)
async def delete_transaction(
    tx_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.organization_id == current_user.organization_id,
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Транзакция не найдена")
    await db.delete(tx)
    await cache.invalidate_org(str(current_user.organization_id))


@router.get("/transactions/{tx_id}", response_model=TransactionResponse)
async def get_transaction(
    tx_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.organization_id == current_user.organization_id,
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Транзакция не найдена")
    return tx


@router.get("/reports/counterparty-turnover")
async def counterparty_turnover(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обороты по контрагентам за период."""
    from app.models.counterparty import Counterparty

    filters = [
        Transaction.organization_id == current_user.organization_id,
        Transaction.counterparty_id.isnot(None),
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)

    result = await db.execute(
        select(
            Transaction.counterparty_id,
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .where(and_(*filters))
        .group_by(Transaction.counterparty_id, Transaction.type)
    )
    rows = result.all()

    cp_ids = list({r.counterparty_id for r in rows})
    cp_map: dict[str, str] = {}
    if cp_ids:
        cp_result = await db.execute(
            select(Counterparty.id, Counterparty.name).where(Counterparty.id.in_(cp_ids))
        )
        cp_map = {r.id: r.name for r in cp_result.all()}

    agg: dict[str, dict] = {}
    for r in rows:
        cp_id = r.counterparty_id
        if cp_id not in agg:
            agg[cp_id] = {"counterparty_id": cp_id, "name": cp_map.get(cp_id, "—"), "income": 0, "expense": 0, "count": 0}
        if r.type == "income":
            agg[cp_id]["income"] += float(r.total)
        else:
            agg[cp_id]["expense"] += float(r.total)
        agg[cp_id]["count"] += r.count

    items = sorted(agg.values(), key=lambda x: x["income"] + x["expense"], reverse=True)
    return {"items": items}
