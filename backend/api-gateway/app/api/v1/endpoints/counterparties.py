import csv
import io
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.counterparty import Counterparty
from app.models.user import User
from app.schemas.counterparty import (
    CounterpartyCreate,
    CounterpartyListResponse,
    CounterpartyQuickUnp,
    CounterpartyResponse,
    CounterpartyUpdate,
    decimal_str,
)
from app.services.counterparty_stats import (
    batch_counterparty_stats,
    opening_balance_until,
    transactions_for_period,
)

router = APIRouter(
    prefix="/counterparties",
    tags=["counterparties"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


def _org_id(u: User) -> str:
    if not u.organization_id:
        raise HTTPException(
            status_code=400,
            detail="Пользователь не привязан к организации.",
        )
    return str(u.organization_id)


def _signed_delta(tx: Transaction) -> Decimal:
    return Decimal(str(tx.amount)) if tx.type == "income" else -Decimal(str(tx.amount))


@router.get("", response_model=list[CounterpartyListResponse])
async def list_counterparties(
    q: str | None = Query(None, description="Поиск по названию или УНП"),
    active_only: bool = Query(True),
    include_stats: bool = Query(False, description="Подгрузить сальдо и активность за неделю"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = _org_id(current_user)
    filters = [Counterparty.organization_id == org_id]
    if active_only:
        filters.append(Counterparty.is_active == True)  # noqa: E712
    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(or_(Counterparty.name.ilike(term), Counterparty.unp.ilike(term)))

    result = await db.execute(
        select(Counterparty).where(and_(*filters)).order_by(Counterparty.is_pinned.desc(), Counterparty.name)
    )
    rows = list(result.scalars().all())

    stats_map: dict = {}
    if include_stats and rows:
        stats_map = await batch_counterparty_stats(db, org_id, rows)

    out: list[CounterpartyListResponse] = []
    for cp in rows:
        base = CounterpartyResponse.model_validate(cp).model_dump()
        if include_stats:
            st = stats_map.get(str(cp.id), {})
            amt = st.get("last_transaction_amount")
            base.update(
                {
                    "balance_net": decimal_str(st.get("balance_net")),
                    "last_transaction_date": st.get("last_transaction_date"),
                    "last_transaction_amount": decimal_str(amt) if amt is not None else None,
                    "week_tx_count": int(st.get("week_tx_count") or 0),
                }
            )
        else:
            base.update(
                {
                    "balance_net": "0",
                    "last_transaction_date": None,
                    "last_transaction_amount": None,
                    "week_tx_count": 0,
                }
            )
        out.append(CounterpartyListResponse(**base))
    return out


@router.post("/quick-unp", response_model=CounterpartyResponse, status_code=201)
async def create_counterparty_quick_unp(
    body: CounterpartyQuickUnp,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Быстрое добавление по УНП (до интеграции ЕГР — название задаётся вручную или шаблоном)."""
    org_id = _org_id(current_user)
    existing = await db.execute(
        select(Counterparty).where(
            Counterparty.organization_id == org_id,
            Counterparty.unp == body.unp,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Контрагент с УНП {body.unp} уже есть")

    title = (body.name or "").strip() or f"Субъект хозяйствования, УНП {body.unp}"
    cp = Counterparty(
        organization_id=org_id,
        name=title,
        unp=body.unp,
        cp_kind="both",
    )
    db.add(cp)
    await db.flush()
    return cp


@router.get("/{cp_id}/reconciliation")
async def reconciliation_csv(
    cp_id: str,
    date_from: date = Query(..., description="Начало периода"),
    date_to: date = Query(..., description="Конец периода"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Акт сверки за период (CSV; PDF — позже по шаблону)."""
    org_id = _org_id(current_user)
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="Неверный период")

    result = await db.execute(
        select(Counterparty).where(Counterparty.id == cp_id, Counterparty.organization_id == org_id)
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Контрагент не найден")

    opening = await opening_balance_until(db, org_id, cp_id, date_from)
    txs = await transactions_for_period(db, org_id, cp_id, date_from, date_to)

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    buf.write("\ufeff")
    w.writerow(["Акт сверки взаиморасчётов (выгрузка)"])
    w.writerow(["Контрагент", cp.name])
    w.writerow(["УНП", cp.unp])
    w.writerow(["Период", f"{date_from.isoformat()} — {date_to.isoformat()}"])
    w.writerow([])
    w.writerow(["Начальное сальдо на дату периода", decimal_str(opening)])
    w.writerow([])
    w.writerow(["Дата", "Тип", "Сумма", "Описание", "Накопительно"])
    running = opening
    for tx in txs:
        running += _signed_delta(tx)
        w.writerow(
            [
                tx.transaction_date.isoformat(),
                tx.type,
                decimal_str(Decimal(str(tx.amount))),
                (tx.description or "").replace("\n", " "),
                decimal_str(running),
            ]
        )
    w.writerow([])
    w.writerow(["Конечное сальдо", decimal_str(running)])

    data = buf.getvalue().encode("utf-8")
    filename = f"akt-sverki-{cp.unp}-{date_from}_{date_to}.csv"
    return StreamingResponse(
        iter([data]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", response_model=CounterpartyResponse, status_code=201)
async def create_counterparty(
    body: CounterpartyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = _org_id(current_user)
    existing = await db.execute(
        select(Counterparty).where(
            Counterparty.organization_id == org_id,
            Counterparty.unp == body.unp,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Контрагент с УНП {body.unp} уже существует")

    cp = Counterparty(
        organization_id=org_id,
        **body.model_dump(),
    )
    db.add(cp)
    await db.flush()
    return cp


@router.get("/{cp_id}", response_model=CounterpartyResponse)
async def get_counterparty(
    cp_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = _org_id(current_user)
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.id == cp_id,
            Counterparty.organization_id == org_id,
        )
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
    return cp


@router.put("/{cp_id}", response_model=CounterpartyResponse)
async def update_counterparty(
    cp_id: str,
    body: CounterpartyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = _org_id(current_user)
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.id == cp_id,
            Counterparty.organization_id == org_id,
        )
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Контрагент не найден")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(cp, field, value)

    await db.flush()
    return cp


@router.delete("/{cp_id}", status_code=204)
async def delete_counterparty(
    cp_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = _org_id(current_user)
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.id == cp_id,
            Counterparty.organization_id == org_id,
        )
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
    cp.is_active = False
    await db.flush()
