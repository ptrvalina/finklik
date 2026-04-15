import base64
import hmac
import io
import json
import re
from decimal import Decimal
from urllib.parse import quote

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel, EmailStr, Field
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.counterparty import Counterparty
from app.models.document import PaymentEvent, PrimaryDocument
from app.models.transaction import Transaction
from app.models.user import Organization, User
from app.schemas.primary_document import (
    PrimaryDocumentCreate,
    PrimaryDocumentResponse,
    PrimaryDocumentUpdate,
)
from app.services.primary_document_numbering import allocate_next_document_number, peek_next_document_number
from app.services.primary_document_pdf import PrimaryDocumentPdfContext, generate_primary_document_pdf
from app.services.email_service import send_payment_link_email

router = APIRouter(prefix="/primary-documents", tags=["primary-documents"])


class PaymentWebhookPayload(BaseModel):
    doc_id: str | None = Field(default=None, min_length=8, max_length=64)
    organization_id: str | None = Field(default=None, min_length=8, max_length=64)
    doc_number: str | None = Field(default=None, min_length=1, max_length=40)
    status: str = Field(default="paid", pattern="^(paid|pending|failed)$")
    amount: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    payment_id: str | None = Field(default=None, min_length=3, max_length=128)
    description: str | None = Field(default=None, max_length=500)


class PaymentLinkSendPayload(BaseModel):
    email: EmailStr


async def _record_payment_event(
    db: AsyncSession,
    *,
    doc: PrimaryDocument,
    event_type: str,
    source: str,
    payload: dict | None = None,
) -> None:
    db.add(
        PaymentEvent(
            organization_id=doc.organization_id,
            doc_id=doc.id,
            event_type=event_type,
            source=source,
            payload_json=json.dumps(payload, ensure_ascii=False) if payload is not None else None,
        )
    )


async def _mark_invoice_paid(
    db: AsyncSession,
    doc: PrimaryDocument,
    *,
    amount: float | None = None,
    currency: str | None = None,
    payment_id: str | None = None,
    description: str | None = None,
) -> None:
    if doc.doc_type != "invoice":
        raise HTTPException(status_code=400, detail="Операция оплаты применима только к invoice")
    tag = f"payment:{payment_id}" if payment_id else None
    if tag:
        existing_r = await db.execute(
            select(Transaction).where(
                Transaction.organization_id == doc.organization_id,
                Transaction.category == "bank_import",
                Transaction.description == tag,
            )
        )
        existing = existing_r.scalar_one_or_none()
        if existing:
            expected_amount = amount if amount is not None else doc.amount_total
            expected_currency = (currency or doc.currency).upper()
            if Decimal(str(existing.amount)) != Decimal(str(expected_amount)) or existing.currency.upper() != expected_currency:
                raise HTTPException(status_code=409, detail="Повторный payment_id с другой суммой или валютой")
            doc.transaction_id = existing.id
            doc.status = "paid"
            return
    if not doc.transaction_id:
        tx = Transaction(
            organization_id=doc.organization_id,
            type="income",
            amount=amount if amount is not None else doc.amount_total,
            currency=(currency or doc.currency).upper(),
            category="bank_import",
            description=tag or description or f"Оплата по счёту {doc.doc_number}",
            transaction_date=doc.issue_date,
            status="posted",
        )
        db.add(tx)
        await db.flush()
        doc.transaction_id = tx.id
    doc.status = "paid"


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


@router.get("/{doc_id}/payment-qr")
async def primary_document_payment_qr(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """QR и ссылка для оплаты счёта (спринт 9): демо-формат, без реального ЕРИП."""
    result = await db.execute(
        select(PrimaryDocument).where(
            PrimaryDocument.id == doc_id,
            PrimaryDocument.organization_id == current_user.organization_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if doc.doc_type != "invoice":
        raise HTTPException(status_code=400, detail="QR оплаты доступен только для счёта (invoice)")

    pay_url = f"{settings.FRONTEND_URL.rstrip('/')}/documents?pay={doc.id}"
    qr_text = (
        f"FINKLIK|PAY|{doc.currency}|{float(doc.amount_total):.2f}|{doc.doc_number}|{doc.id}|{doc.organization_id}"
    )
    img = qrcode.make(qr_text, box_size=4)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return {
        "doc_id": doc.id,
        "doc_number": doc.doc_number,
        "amount": float(doc.amount_total),
        "currency": doc.currency,
        "payment_url": pay_url,
        "qr_text": qr_text,
        "qr_png_base64": b64,
        "scheme": "finklik-demo",
    }


@router.get("/{doc_id}/payment-status")
async def primary_document_payment_status(
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
    if doc.doc_type != "invoice":
        raise HTTPException(status_code=400, detail="Статус оплаты доступен только для счёта (invoice)")
    return {
        "doc_id": doc.id,
        "doc_number": doc.doc_number,
        "status": doc.status,
        "is_paid": doc.status == "paid",
        "transaction_id": doc.transaction_id,
    }


@router.post("/{doc_id}/payment-link/send")
async def send_primary_document_payment_link(
    doc_id: str,
    body: PaymentLinkSendPayload,
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
    if doc.doc_type != "invoice":
        raise HTTPException(status_code=400, detail="Ссылка оплаты доступна только для счёта (invoice)")

    org_row = await db.execute(select(Organization).where(Organization.id == doc.organization_id))
    org = org_row.scalar_one_or_none()
    org_name = org.name if org else "ФинКлик"

    payment_url = f"{settings.FRONTEND_URL.rstrip('/')}/documents?pay={doc.id}"
    sent = await send_payment_link_email(
        str(body.email),
        org_name=org_name,
        doc_number=doc.doc_number,
        amount=float(doc.amount_total),
        currency=doc.currency,
        payment_url=payment_url,
    )
    await _record_payment_event(
        db,
        doc=doc,
        event_type="payment_link_sent",
        source="ui",
        payload={"email": str(body.email), "email_sent": bool(sent), "payment_url": payment_url},
    )
    await db.flush()
    return {
        "ok": True,
        "email": str(body.email),
        "email_sent": sent,
        "payment_url": payment_url,
    }


@router.post("/{doc_id}/mark-paid")
async def primary_document_mark_paid(
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
    await _mark_invoice_paid(db, doc, description="Ручное подтверждение оплаты из интерфейса")
    await _record_payment_event(
        db,
        doc=doc,
        event_type="manual_mark_paid",
        source="ui",
        payload={"status": doc.status, "transaction_id": doc.transaction_id},
    )
    await db.flush()
    return {
        "ok": True,
        "doc_id": doc.id,
        "status": doc.status,
        "transaction_id": doc.transaction_id,
    }


@router.post("/webhooks/payment")
async def payment_webhook(
    body: PaymentWebhookPayload,
    x_secret: str | None = Header(None, alias="X-Payment-Webhook-Secret"),
    db: AsyncSession = Depends(get_db),
):
    expected = settings.PAYMENT_WEBHOOK_SECRET
    if not expected:
        raise HTTPException(status_code=404, detail="Not found")
    if not hmac.compare_digest((x_secret or "").encode(), expected.encode()):
        raise HTTPException(status_code=404, detail="Not found")

    if body.doc_id:
        result = await db.execute(select(PrimaryDocument).where(PrimaryDocument.id == body.doc_id))
    else:
        if not body.organization_id or not body.doc_number:
            raise HTTPException(status_code=400, detail="Нужен doc_id или пара organization_id + doc_number")
        result = await db.execute(
            select(PrimaryDocument).where(
                PrimaryDocument.organization_id == body.organization_id,
                PrimaryDocument.doc_number == body.doc_number,
                PrimaryDocument.doc_type == "invoice",
            )
        )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if doc.doc_type != "invoice":
        raise HTTPException(status_code=400, detail="Webhook оплаты применим только к invoice")

    if body.status == "paid":
        try:
            await _mark_invoice_paid(
                db,
                doc,
                amount=body.amount,
                currency=body.currency,
                payment_id=body.payment_id,
                description=body.description,
            )
            await _record_payment_event(
                db,
                doc=doc,
                event_type="webhook_paid",
                source="webhook",
                payload={
                    "payment_id": body.payment_id,
                    "amount": body.amount,
                    "currency": body.currency,
                    "transaction_id": doc.transaction_id,
                },
            )
        except HTTPException as exc:
            if exc.status_code == 409:
                await _record_payment_event(
                    db,
                    doc=doc,
                    event_type="webhook_conflict",
                    source="webhook",
                    payload={
                        "payment_id": body.payment_id,
                        "amount": body.amount,
                        "currency": body.currency,
                        "detail": str(exc.detail),
                    },
                )
                await db.flush()
            raise
    elif body.status == "pending":
        if doc.status == "draft":
            doc.status = "issued"
        await _record_payment_event(
            db,
            doc=doc,
            event_type="webhook_pending",
            source="webhook",
            payload={"payment_id": body.payment_id},
        )
    elif body.status == "failed":
        await _record_payment_event(
            db,
            doc=doc,
            event_type="webhook_failed",
            source="webhook",
            payload={"payment_id": body.payment_id, "description": body.description},
        )

    await db.flush()
    return {
        "ok": True,
        "doc_id": doc.id,
        "status": doc.status,
        "transaction_id": doc.transaction_id,
    }


@router.get("/{doc_id}/payment-events")
async def primary_document_payment_events(
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
    if doc.doc_type != "invoice":
        raise HTTPException(status_code=400, detail="История оплаты доступна только для счёта (invoice)")

    events_r = await db.execute(
        select(PaymentEvent)
        .where(
            PaymentEvent.organization_id == doc.organization_id,
            PaymentEvent.doc_id == doc.id,
        )
        .order_by(PaymentEvent.created_at.desc())
    )
    events = events_r.scalars().all()
    data = []
    for ev in events:
        payload = None
        if ev.payload_json:
            try:
                payload = json.loads(ev.payload_json)
            except Exception:
                payload = {"raw": ev.payload_json}
        data.append(
            {
                "id": ev.id,
                "event_type": ev.event_type,
                "source": ev.source,
                "created_at": ev.created_at.isoformat(),
                "payload": payload,
            }
        )
    by_type: dict[str, int] = {}
    for ev in events:
        by_type[ev.event_type] = by_type.get(ev.event_type, 0) + 1
    return {
        "doc_id": doc.id,
        "events": data,
        "summary": {
            "total": len(events),
            "webhook_success": by_type.get("webhook_paid", 0),
            "webhook_conflict": by_type.get("webhook_conflict", 0),
            "manual_updates": by_type.get("manual_mark_paid", 0),
            "link_sent": by_type.get("payment_link_sent", 0),
            "by_type": by_type,
        },
    }


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
