from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.models.counterparty import Counterparty
from app.schemas.counterparty import CounterpartyCreate, CounterpartyUpdate, CounterpartyResponse

router = APIRouter(
    prefix="/counterparties",
    tags=["counterparties"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


@router.get("", response_model=list[CounterpartyResponse])
async def list_counterparties(
    q: str | None = Query(None, description="Поиск по названию или УНП"),
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [Counterparty.organization_id == current_user.organization_id]
    if active_only:
        filters.append(Counterparty.is_active == True)
    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(
            or_(Counterparty.name.ilike(term), Counterparty.unp.ilike(term))
        )

    result = await db.execute(
        select(Counterparty).where(and_(*filters)).order_by(Counterparty.name)
    )
    return result.scalars().all()


@router.post("", response_model=CounterpartyResponse, status_code=201)
async def create_counterparty(
    body: CounterpartyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Counterparty).where(
            Counterparty.organization_id == current_user.organization_id,
            Counterparty.unp == body.unp,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Контрагент с УНП {body.unp} уже существует")

    cp = Counterparty(
        organization_id=current_user.organization_id,
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
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.id == cp_id,
            Counterparty.organization_id == current_user.organization_id,
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
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.id == cp_id,
            Counterparty.organization_id == current_user.organization_id,
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
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.id == cp_id,
            Counterparty.organization_id == current_user.organization_id,
        )
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
    cp.is_active = False
    await db.flush()
