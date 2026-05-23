"""Business OS API: доменные сущности, обязательства, сверка, снимок состояния, ИИ-разбор."""

from __future__ import annotations

import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis_cache import cache
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.models.business_os import (
    AIMemoryEntry,
    BusinessEntity,
    CostCenter,
    FinancialObligation,
    ReconciliationMatch,
    RevenueStream,
    WorkflowAction,
)
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.business_os import (
    AIMemoryEntryCreate,
    AIMemoryEntryResponse,
    AIAnalysisResponse,
    BusinessEntityCreate,
    BusinessEntityResponse,
    BusinessStateResponse,
    CostCenterCreate,
    CostCenterResponse,
    FinancialObligationCreate,
    FinancialObligationResponse,
    FinancialObligationUpdate,
    ReconciliationMatchCreate,
    ReconciliationMatchResponse,
    RevenueStreamCreate,
    RevenueStreamResponse,
    WorkflowActionCreate,
    WorkflowActionResponse,
)
from app.services.business_state_service import compute_business_state
from app.services.financial_state_service import refresh_financial_state_audit
from app.services.structured_ai_analysis import analyze_transaction_ai
from app.events.emit import (
    emit_ai_suggestion_recorded,
    emit_obligation_created,
    emit_reconciliation_confirmed,
    emit_reconciliation_match_recorded,
)

router = APIRouter(
    prefix="/business",
    tags=["business-os"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


def _org_id(user: User) -> str:
    oid = workspace_organization_id(user)
    if not oid:
        raise HTTPException(status_code=400, detail="Нет организации")
    return oid


@router.get("/state", response_model=BusinessStateResponse)
async def get_business_state(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await compute_business_state(db, _org_id(current_user))


@router.post("/entities", response_model=BusinessEntityResponse, status_code=201)
async def create_business_entity(
    body: BusinessEntityCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    row = BusinessEntity(
        id=str(uuid.uuid4()),
        organization_id=oid,
        name=body.name.strip(),
        entity_type=body.entity_type,
        counterparty_id=body.counterparty_id,
    )
    db.add(row)
    await db.flush()
    return row


@router.get("/entities", response_model=list[BusinessEntityResponse])
async def list_business_entities(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(select(BusinessEntity).where(BusinessEntity.organization_id == oid).order_by(BusinessEntity.name))
    return list(r.scalars().all())


@router.post("/cost-centers", response_model=CostCenterResponse, status_code=201)
async def create_cost_center(
    body: CostCenterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    row = CostCenter(
        id=str(uuid.uuid4()),
        organization_id=oid,
        name=body.name.strip(),
        center_type=body.center_type,
    )
    db.add(row)
    await db.flush()
    return row


@router.get("/cost-centers", response_model=list[CostCenterResponse])
async def list_cost_centers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(select(CostCenter).where(CostCenter.organization_id == oid).order_by(CostCenter.name))
    return list(r.scalars().all())


@router.post("/revenue-streams", response_model=RevenueStreamResponse, status_code=201)
async def create_revenue_stream(
    body: RevenueStreamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    row = RevenueStream(
        id=str(uuid.uuid4()),
        organization_id=oid,
        name=body.name.strip(),
        source=(body.source or "").strip() or None,
    )
    db.add(row)
    await db.flush()
    return row


@router.get("/revenue-streams", response_model=list[RevenueStreamResponse])
async def list_revenue_streams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(select(RevenueStream).where(RevenueStream.organization_id == oid).order_by(RevenueStream.name))
    return list(r.scalars().all())


@router.post("/obligations", response_model=FinancialObligationResponse, status_code=201)
async def create_obligation(
    body: FinancialObligationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    row = FinancialObligation(
        id=str(uuid.uuid4()),
        organization_id=oid,
        obligation_type=body.obligation_type,
        amount=body.amount,
        due_date=body.due_date,
        status=body.status,
        linked_transaction_ids=list(body.linked_transaction_ids),
        notes=body.notes,
    )
    db.add(row)
    await db.flush()
    await emit_obligation_created(
        db,
        oid,
        row.id,
        obligation_type=row.obligation_type,
        amount=row.amount,
        due_date=row.due_date.isoformat(),
        actor="user",
    )
    return row


@router.get("/obligations", response_model=list[FinancialObligationResponse])
async def list_obligations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(
        select(FinancialObligation).where(FinancialObligation.organization_id == oid).order_by(FinancialObligation.due_date)
    )
    rows = list(r.scalars().all())
    out: list[FinancialObligationResponse] = []
    for x in rows:
        lids = x.linked_transaction_ids if isinstance(x.linked_transaction_ids, list) else []
        out.append(
            FinancialObligationResponse(
                id=x.id,
                obligation_type=x.obligation_type,
                amount=x.amount,
                due_date=x.due_date,
                status=x.status,
                linked_transaction_ids=lids,
                notes=x.notes,
                created_at=x.created_at,
                updated_at=x.updated_at,
            )
        )
    return out


@router.patch("/obligations/{obligation_id}", response_model=FinancialObligationResponse)
async def update_obligation(
    obligation_id: str,
    body: FinancialObligationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(
        select(FinancialObligation).where(
            FinancialObligation.id == obligation_id,
            FinancialObligation.organization_id == oid,
        )
    )
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Обязательство не найдено")
    patch = body.model_dump(exclude_unset=True)
    if "linked_transaction_ids" in patch and patch["linked_transaction_ids"] is not None:
        row.linked_transaction_ids = list(patch["linked_transaction_ids"])
        del patch["linked_transaction_ids"]
    for k, v in patch.items():
        setattr(row, k, v)
    await db.flush()
    lids = row.linked_transaction_ids if isinstance(row.linked_transaction_ids, list) else []
    return FinancialObligationResponse(
        id=row.id,
        obligation_type=row.obligation_type,
        amount=row.amount,
        due_date=row.due_date,
        status=row.status,
        linked_transaction_ids=lids,
        notes=row.notes,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.post("/reconciliation-matches", response_model=ReconciliationMatchResponse, status_code=201)
async def create_reconciliation_match(
    body: ReconciliationMatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    row = ReconciliationMatch(
        id=str(uuid.uuid4()),
        organization_id=oid,
        transaction_id=body.transaction_id,
        document_id=body.document_id,
        confidence=body.confidence,
        status=body.status,
    )
    db.add(row)
    await db.flush()
    await emit_reconciliation_match_recorded(
        db,
        oid,
        row.id,
        transaction_id=body.transaction_id,
        document_id=body.document_id,
        confidence=float(body.confidence),
        status=body.status,
        actor="user",
    )
    if body.status == "confirmed":
        await emit_reconciliation_confirmed(
            db,
            oid,
            row.id,
            transaction_id=body.transaction_id,
            document_id=body.document_id,
            confidence=float(body.confidence),
            actor="user",
        )
    await refresh_financial_state_audit(db, oid)
    return row


@router.get("/reconciliation-matches", response_model=list[ReconciliationMatchResponse])
async def list_reconciliation_matches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(
        select(ReconciliationMatch).where(ReconciliationMatch.organization_id == oid).order_by(ReconciliationMatch.created_at.desc())
    )
    return list(r.scalars().all())


@router.post("/workflow-actions", response_model=WorkflowActionResponse, status_code=201)
async def log_workflow_action(
    body: WorkflowActionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    row = WorkflowAction(
        id=str(uuid.uuid4()),
        organization_id=oid,
        action_type=body.action_type,
        target_id=body.target_id,
        target_kind=body.target_kind,
        status=body.status,
        performed_by_user_id=str(current_user.id),
        metadata_json=body.metadata_json,
    )
    db.add(row)
    await db.flush()
    return row


@router.get("/workflow-actions", response_model=list[WorkflowActionResponse])
async def list_workflow_actions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(
        select(WorkflowAction).where(WorkflowAction.organization_id == oid).order_by(WorkflowAction.created_at.desc()).limit(200)
    )
    return list(r.scalars().all())


@router.post("/ai-memory", response_model=AIMemoryEntryResponse, status_code=201)
async def append_ai_memory(
    body: AIMemoryEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    try:
        json.loads(body.payload_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="payload_json должен быть валидным JSON")
    row = AIMemoryEntry(
        id=str(uuid.uuid4()),
        organization_id=oid,
        memory_type=body.memory_type,
        payload_json=body.payload_json,
    )
    db.add(row)
    await db.flush()
    return row


@router.get("/ai-memory", response_model=list[AIMemoryEntryResponse])
async def list_ai_memory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(
        select(AIMemoryEntry).where(AIMemoryEntry.organization_id == oid).order_by(AIMemoryEntry.created_at.desc()).limit(500)
    )
    return list(r.scalars().all())


@router.post("/transactions/{transaction_id}/analyze", response_model=AIAnalysisResponse)
async def analyze_transaction_endpoint(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    r = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.organization_id == oid)
    )
    tx = r.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Операция не найдена")
    analysis = await analyze_transaction_ai(db, tx)
    tx.ai_analysis_json = analysis.model_dump_json()
    await db.flush()
    await emit_ai_suggestion_recorded(
        db,
        oid,
        transaction_id,
        analysis=analysis.model_dump(mode="json"),
        actor="ai",
    )
    await cache.invalidate_org(oid)
    return analysis
