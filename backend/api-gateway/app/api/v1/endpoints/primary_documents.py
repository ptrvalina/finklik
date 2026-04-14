from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.counterparty import Counterparty
from app.models.document import PrimaryDocument
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.primary_document import (
    PrimaryDocumentCreate,
    PrimaryDocumentResponse,
    PrimaryDocumentUpdate,
)

router = APIRouter(prefix="/primary-documents", tags=["primary-documents"])


async def _validate_links(
    db: AsyncSession,
    org_id: str,
    counterparty_id: str | None,
    transaction_id: str | None,
) -> None:
    if counterparty_id:
        cp = await db.execute(
            select(Counterparty.id).where(
                Counterparty.id == counterparty_id,
                Counterparty.organization_id == org_id,
            )
        )
        if not cp.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Контрагент не найден в вашей организации")

    if transaction_id:
        tx = await db.execute(
            select(Transaction.id).where(
                Transaction.id == transaction_id,
                Transaction.organization_id == org_id,
            )
        )
        if not tx.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Транзакция не найдена в вашей организации")


@router.get("", response_model=list[PrimaryDocumentResponse])
async def list_primary_documents(
    doc_type: str | None = Query(None, pattern="^(invoice|act|waybill)$"),
    status: str | None = Query(None, pattern="^(draft|issued|paid|cancelled)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [PrimaryDocument.organization_id == current_user.organization_id]
    if doc_type:
        filters.append(PrimaryDocument.doc_type == doc_type)
    if status:
        filters.append(PrimaryDocument.status == status)

    result = await db.execute(
        select(PrimaryDocument)
        .where(*filters)
        .order_by(PrimaryDocument.issue_date.desc(), PrimaryDocument.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=PrimaryDocumentResponse, status_code=201)
async def create_primary_document(
    body: PrimaryDocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    if not org_id:
        raise HTTPException(status_code=400, detail="Пользователь не привязан к организации")

    dup = await db.execute(
        select(PrimaryDocument.id).where(
            PrimaryDocument.organization_id == org_id,
            PrimaryDocument.doc_type == body.doc_type,
            PrimaryDocument.doc_number == body.doc_number,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Документ с таким номером уже существует")

    await _validate_links(db, org_id, body.counterparty_id, body.transaction_id)

    doc = PrimaryDocument(
        organization_id=org_id,
        created_by_user_id=current_user.id,
        **body.model_dump(),
    )
    db.add(doc)
    await db.flush()
    return doc


@router.get("/{doc_id}", response_model=PrimaryDocumentResponse)
async def get_primary_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PrimaryDocument).where(
            PrimaryDocument.id == doc_id,
            PrimaryDocument.organization_id == current_user.organization_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    return doc


@router.put("/{doc_id}", response_model=PrimaryDocumentResponse)
async def update_primary_document(
    doc_id: str,
    body: PrimaryDocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PrimaryDocument).where(
            PrimaryDocument.id == doc_id,
            PrimaryDocument.organization_id == current_user.organization_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    payload = body.model_dump(exclude_unset=True)
    next_counterparty_id = payload.get("counterparty_id", doc.counterparty_id)
    next_transaction_id = payload.get("transaction_id", doc.transaction_id)
    await _validate_links(db, current_user.organization_id, next_counterparty_id, next_transaction_id)

    if "doc_number" in payload:
        doc_number = payload["doc_number"]
        if doc_number != doc.doc_number:
            dup = await db.execute(
                select(PrimaryDocument.id).where(
                    PrimaryDocument.organization_id == current_user.organization_id,
                    PrimaryDocument.doc_type == doc.doc_type,
                    PrimaryDocument.doc_number == doc_number,
                    PrimaryDocument.id != doc.id,
                )
            )
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Документ с таким номером уже существует")

    for key, value in payload.items():
        setattr(doc, key, value)

    await db.flush()
    return doc


@router.delete("/{doc_id}", status_code=204)
async def delete_primary_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PrimaryDocument).where(
            PrimaryDocument.id == doc_id,
            PrimaryDocument.organization_id == current_user.organization_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    await db.delete(doc)


@router.get("/{doc_id}/print")
async def print_primary_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PrimaryDocument).where(
            PrimaryDocument.id == doc_id,
            PrimaryDocument.organization_id == current_user.organization_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    # Sprint 6 baseline: return printable payload; PDF rendering is next iteration.
    return {
        "printable": True,
        "format": "json-preview",
        "document": {
            "id": doc.id,
            "type": doc.doc_type,
            "number": doc.doc_number,
            "status": doc.status,
            "issue_date": doc.issue_date.isoformat(),
            "due_date": doc.due_date.isoformat() if doc.due_date else None,
            "currency": doc.currency,
            "amount_total": float(doc.amount_total),
            "title": doc.title,
            "description": doc.description,
        },
    }
