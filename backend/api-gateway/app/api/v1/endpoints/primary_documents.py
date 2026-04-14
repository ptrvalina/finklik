import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.counterparty import Counterparty
from app.models.document import PrimaryDocument
from app.models.transaction import Transaction
from app.models.user import Organization, User
from app.schemas.primary_document import (
    PrimaryDocumentCreate,
    PrimaryDocumentResponse,
    PrimaryDocumentUpdate,
)
from app.services.primary_document_numbering import allocate_next_document_number, peek_next_document_number
from app.services.primary_document_pdf import PrimaryDocumentPdfContext, generate_primary_document_pdf

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


async def _validate_related_document(
    db: AsyncSession,
    org_id: str,
    related_id: str | None,
    doc_type: str,
) -> None:
    if not related_id:
        return
    res = await db.execute(
        select(PrimaryDocument).where(
            PrimaryDocument.id == related_id,
            PrimaryDocument.organization_id == org_id,
        )
    )
    rel = res.scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=400, detail="Связанный документ не найден")
    if doc_type in ("act", "waybill") and rel.doc_type != "invoice":
        raise HTTPException(
            status_code=400,
            detail="Для акта и накладной связанным документом должен быть счёт (invoice)",
        )


def _attachment_filename(doc: PrimaryDocument) -> str:
    raw = f"{doc.doc_type}_{doc.doc_number}"
    safe = re.sub(r"[^a-zA-Z0-9._А-Яа-яЁё-]+", "_", raw).strip("_") or f"doc_{doc.id[:8]}"
    return f"{safe[:100]}.pdf"


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


@router.get("/next-number", response_model=dict[str, str])
async def get_next_number_preview(
    doc_type: str = Query(..., pattern="^(invoice|act|waybill)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Подсказка следующего номера (без резервирования)."""
    org_id = current_user.organization_id
    if not org_id:
        raise HTTPException(status_code=400, detail="Пользователь не привязан к организации")
    n = await peek_next_document_number(db, org_id, doc_type)
    return {"doc_type": doc_type, "suggested_number": n}


@router.post("", response_model=PrimaryDocumentResponse, status_code=201)
async def create_primary_document(
    body: PrimaryDocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    if not org_id:
        raise HTTPException(status_code=400, detail="Пользователь не привязан к организации")

    if body.use_auto_number:
        doc_number = await allocate_next_document_number(db, org_id, body.doc_type)
    else:
        doc_number = str(body.doc_number).strip()

    dup = await db.execute(
        select(PrimaryDocument.id).where(
            PrimaryDocument.organization_id == org_id,
            PrimaryDocument.doc_type == body.doc_type,
            PrimaryDocument.doc_number == doc_number,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Документ с таким номером уже существует")

    await _validate_links(db, org_id, body.counterparty_id, body.transaction_id)
    await _validate_related_document(db, org_id, body.related_document_id, body.doc_type)

    payload = body.model_dump(exclude={"use_auto_number", "doc_number"}, exclude_unset=False)
    payload["doc_number"] = doc_number

    doc = PrimaryDocument(
        organization_id=org_id,
        created_by_user_id=current_user.id,
        **payload,
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
    next_related = payload.get("related_document_id", doc.related_document_id)
    next_type = doc.doc_type

    await _validate_links(db, current_user.organization_id, next_counterparty_id, next_transaction_id)
    await _validate_related_document(db, current_user.organization_id, next_related, next_type)

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
    format: str | None = Query("pdf", pattern="^(pdf|json)$"),
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

    if format == "json":
        if not settings.DEBUG:
            raise HTTPException(status_code=404, detail="Not found")
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

    org_row = await db.execute(select(Organization).where(Organization.id == doc.organization_id))
    org = org_row.scalar_one()

    cp_name = cp_unp = cp_addr = None
    if doc.counterparty_id:
        cp_r = await db.execute(select(Counterparty).where(Counterparty.id == doc.counterparty_id))
        cp = cp_r.scalar_one_or_none()
        if cp:
            cp_name, cp_unp, cp_addr = cp.name, cp.unp, cp.address

    rel_num = rel_dt = None
    if doc.related_document_id:
        rel_r = await db.execute(
            select(PrimaryDocument).where(
                PrimaryDocument.id == doc.related_document_id,
                PrimaryDocument.organization_id == doc.organization_id,
            )
        )
        rel = rel_r.scalar_one_or_none()
        if rel:
            rel_num, rel_dt = rel.doc_number, rel.issue_date

    ctx = PrimaryDocumentPdfContext(
        doc_type=doc.doc_type,
        doc_number=doc.doc_number,
        status=doc.status,
        issue_date=doc.issue_date,
        due_date=doc.due_date,
        currency=doc.currency,
        amount_total=doc.amount_total,
        title=doc.title,
        description=doc.description,
        seller_name=org.name,
        seller_unp=org.unp,
        seller_legal_form=org.legal_form,
        counterparty_name=cp_name,
        counterparty_unp=cp_unp,
        counterparty_address=cp_addr,
        related_invoice_number=rel_num,
        related_invoice_date=rel_dt,
    )
    pdf_bytes = generate_primary_document_pdf(ctx)
    fname = _attachment_filename(doc)
    ascii_fallback = re.sub(r"[^a-zA-Z0-9._-]", "_", fname) or "document.pdf"
    cd = f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(fname)}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd},
    )
