from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.categorization_rule import CategorizationRule
from app.models.user import User
from app.schemas.categorization_rule import (
    CategorizationRuleCreate,
    CategorizationRuleResponse,
    validate_rule_category,
)

router = APIRouter(
    prefix="/categorization-rules",
    tags=["categorization-rules"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


@router.get("", response_model=list[CategorizationRuleResponse])
async def list_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CategorizationRule)
        .where(CategorizationRule.organization_id == current_user.organization_id)
        .order_by(CategorizationRule.priority.asc(), CategorizationRule.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=CategorizationRuleResponse, status_code=201)
async def create_rule(
    body: CategorizationRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        validate_rule_category(body.category)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if body.min_amount is not None and body.max_amount is not None and body.min_amount > body.max_amount:
        raise HTTPException(status_code=422, detail="min_amount не может быть больше max_amount")

    row = CategorizationRule(
        organization_id=current_user.organization_id,
        name=body.name.strip(),
        category=body.category,
        transaction_type=body.transaction_type,
        counterparty_id=body.counterparty_id,
        description_pattern=(body.description_pattern or "").strip() or None,
        min_amount=body.min_amount,
        max_amount=body.max_amount,
        vat_required=body.vat_required,
        priority=body.priority,
        is_active=body.is_active,
    )
    db.add(row)
    await db.flush()
    return row


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CategorizationRule).where(
            CategorizationRule.id == rule_id,
            CategorizationRule.organization_id == current_user.organization_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Правило не найдено")
    await db.delete(rule)
