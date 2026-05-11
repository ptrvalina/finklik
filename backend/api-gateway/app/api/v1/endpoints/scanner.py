import json
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user, workspace_organization_id
from app.models.user import User
from app.models.document import ScannedDocument
from app.models.transaction import Transaction
from app.services.ocr_service import tesseract_ocr_process, parse_text_document
from app.services.expense_ai_classifier import classify_expense_category
from app.internal.audit.service import safe_log_audit
from app.events.emit import emit_document_ocr_processed, emit_ocr_linked, emit_transaction_created

router = APIRouter(prefix="/scanner", tags=["scanner"])


class TextParseRequest(BaseModel):
    text: str
    doc_type: str | None = None

MAX_SIZE = 25 * 1024 * 1024  # 25 MB (как в UI сканера)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"}
LOW_CONFIDENCE_THRESHOLD = 75


def _normalize_upload_content_type(content_type: str | None, filename: str) -> str | None:
    """Часть клиентов шлёт application/octet-stream — сопоставляем по расширению."""
    ct = (content_type or "").strip().lower() or None
    fn = (filename or "").lower()
    if ct in ALLOWED_TYPES:
        return ct
    if ct == "application/octet-stream" or ct is None:
        if fn.endswith(".pdf"):
            return "application/pdf"
        if fn.endswith((".jpg", ".jpeg")):
            return "image/jpeg"
        if fn.endswith(".png"):
            return "image/png"
        if fn.endswith(".webp"):
            return "image/webp"
        if fn.endswith(".heic"):
            return "image/heic"
    return ct


def _to_decimal(value: object, default: Decimal = Decimal("0")) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception:
        return default


async def _find_duplicate_or_linked_transaction(
    db: AsyncSession,
    organization_id: str,
    parsed: dict,
) -> tuple[str | None, bool]:
    amount = _to_decimal(parsed.get("amount"))
    tx_date_raw = parsed.get("transaction_date")
    if amount <= 0 or not tx_date_raw:
        return None, False
    try:
        tx_date = date.fromisoformat(str(tx_date_raw))
    except Exception:
        return None, False
    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.organization_id == organization_id,
            Transaction.transaction_date == tx_date,
            Transaction.amount == amount,
        )
        .order_by(desc(Transaction.created_at))
        .limit(1)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        return None, False
    if tx.source == "scan":
        return tx.id, True
    return tx.id, False


@router.post("/upload")
async def upload_and_scan(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    effective_type = _normalize_upload_content_type(file.content_type, file.filename or "")
    if effective_type not in ALLOWED_TYPES:
        raise HTTPException(
            400,
            f"Неподдерживаемый формат: {file.content_type or 'не указан'}. Разрешены: JPEG, PNG, WebP, HEIC, PDF",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Пустой файл")
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 25 МБ)")

    try:
        ocr_result = tesseract_ocr_process(file.filename or "doc.jpg", contents, effective_type)
    except Exception:
        raise HTTPException(
            503,
            "Распознавание временно не завершилось. Попробуйте загрузить файл ещё раз — данные учёта не изменены.",
        ) from None
    parsed = ocr_result.get("parsed", {}) or {}
    linked_tx_id, is_duplicate = await _find_duplicate_or_linked_transaction(
        db=db,
        organization_id=workspace_organization_id(current_user),
        parsed=parsed,
    )

    doc = ScannedDocument(
        organization_id=workspace_organization_id(current_user),
        user_id=current_user.id,
        filename=file.filename or "unknown",
        doc_type=ocr_result["doc_type"],
        status="needs_review" if int(ocr_result.get("confidence", 0)) < LOW_CONFIDENCE_THRESHOLD else "done",
        ocr_text=ocr_result.get("ocr_text", ""),
        parsed_data=json.dumps(parsed, ensure_ascii=False),
        confidence=ocr_result.get("confidence", 0),
        transaction_id=linked_tx_id,
        lifecycle_status="matched" if linked_tx_id else "parsed",
    )
    db.add(doc)
    await db.flush()
    await emit_document_ocr_processed(
        db,
        workspace_organization_id(current_user),
        doc.id,
        parsed=parsed,
        doc_type=ocr_result["doc_type"],
        confidence=int(ocr_result.get("confidence", 0) or 0),
        linked_transaction_id=linked_tx_id,
        lifecycle_status=doc.lifecycle_status,
        actor="system",
    )
    if linked_tx_id:
        await emit_ocr_linked(db, workspace_organization_id(current_user), doc.id, transaction_id=linked_tx_id)
    await safe_log_audit(
        db,
        user_id=str(current_user.id),
        action="scan_uploaded",
        entity_type="scanned_document",
        entity_id=str(doc.id),
        metadata={"doc_type": doc.doc_type, "filename": doc.filename},
    )
    await db.refresh(doc)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "doc_type": doc.doc_type,
        "status": doc.status,
        "confidence": doc.confidence,
        "ocr_text": doc.ocr_text,
        "parsed": parsed,
        "warnings": ocr_result.get("warnings", []),
        "is_duplicate": is_duplicate,
        "linked_transaction_id": linked_tx_id,
        "lifecycle_status": doc.lifecycle_status,
        "created_at": doc.created_at.isoformat(),
    }


@router.post("/upload-to-kudir")
async def upload_to_kudir(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    effective_type = _normalize_upload_content_type(file.content_type, file.filename or "")
    if effective_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Неподдерживаемый формат файла")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Пустой файл")
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 25 МБ)")

    try:
        ocr_result = tesseract_ocr_process(file.filename or "doc.jpg", contents, effective_type)
    except Exception:
        raise HTTPException(
            503,
            "Распознавание временно не завершилось. Попробуйте загрузить файл ещё раз — проводка ещё не создана.",
        ) from None
    parsed = ocr_result.get("parsed", {}) or {}
    try:
        tx_date = date.fromisoformat(str(parsed.get("transaction_date")))
    except Exception:
        tx_date = date.today()
    amount = Decimal(str(parsed.get("amount", 0) or 0))
    vat_amount = Decimal(str(parsed.get("vat_amount", 0) or 0))
    category, confidence = classify_expense_category(
        f"{parsed.get('description', '')}\n{parsed.get('counterparty_name', '')}\n{ocr_result.get('ocr_text', '')}"
    )

    doc = ScannedDocument(
        organization_id=workspace_organization_id(current_user),
        user_id=current_user.id,
        filename=file.filename or "unknown",
        doc_type=ocr_result["doc_type"],
        status="needs_review" if int(ocr_result.get("confidence", 0)) < LOW_CONFIDENCE_THRESHOLD else "done",
        ocr_text=ocr_result.get("ocr_text", ""),
        parsed_data=json.dumps(parsed, ensure_ascii=False),
        confidence=ocr_result.get("confidence", 0),
        lifecycle_status="parsed",
    )
    db.add(doc)
    await db.flush()

    tx = Transaction(
        organization_id=workspace_organization_id(current_user),
        type=parsed.get("type", "expense"),
        amount=amount if amount > 0 else Decimal("0.01"),
        vat_amount=vat_amount if vat_amount >= 0 else Decimal("0"),
        category=category,
        description=parsed.get("description") or f"Скан {file.filename or ''}".strip(),
        transaction_date=tx_date,
        source="scan",
        ai_category_confidence=Decimal(str(confidence)),
        receipt_image_url=f"scanned://{doc.id}/{doc.filename}",
    )
    db.add(tx)
    await db.flush()

    doc.transaction_id = tx.id
    doc.lifecycle_status = "matched"
    oid = workspace_organization_id(current_user)
    await emit_document_ocr_processed(
        db,
        oid,
        doc.id,
        parsed=parsed,
        doc_type=ocr_result["doc_type"],
        confidence=int(ocr_result.get("confidence", 0) or 0),
        linked_transaction_id=tx.id,
        lifecycle_status=doc.lifecycle_status,
        actor="system",
    )
    await emit_transaction_created(db, oid, tx, actor="system")
    await safe_log_audit(
        db,
        user_id=str(current_user.id),
        action="scan_uploaded_to_kudir",
        entity_type="transaction",
        entity_id=str(tx.id),
        metadata={"document_id": str(doc.id), "source": tx.source, "category": tx.category},
    )
    return {
        "document_id": doc.id,
        "transaction_id": tx.id,
        "ai_category": category,
        "ai_category_confidence": confidence,
        "amount": str(tx.amount),
        "source": tx.source,
    }


@router.get("/review-queue")
async def review_queue(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScannedDocument)
        .where(
            ScannedDocument.organization_id == workspace_organization_id(current_user),
            ScannedDocument.status == "needs_review",
        )
        .order_by(desc(ScannedDocument.created_at))
        .limit(limit)
    )
    docs = result.scalars().all()
    return {
        "items": [
            {
                "id": d.id,
                "filename": d.filename,
                "confidence": d.confidence,
                "doc_type": d.doc_type,
                "created_at": d.created_at.isoformat(),
                "transaction_id": d.transaction_id,
                "lifecycle_status": d.lifecycle_status,
            }
            for d in docs
        ]
    }


@router.get("/documents")
async def list_scanned_documents(
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ScannedDocument)
        .where(ScannedDocument.organization_id == workspace_organization_id(current_user))
        .order_by(desc(ScannedDocument.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    docs = result.scalars().all()

    items = []
    for d in docs:
        parsed = {}
        if d.parsed_data:
            try:
                parsed = json.loads(d.parsed_data)
            except json.JSONDecodeError:
                pass
        items.append({
            "id": d.id,
            "filename": d.filename,
            "doc_type": d.doc_type,
            "status": d.status,
            "confidence": d.confidence,
            "parsed": parsed,
            "transaction_id": d.transaction_id,
            "lifecycle_status": d.lifecycle_status,
            "created_at": d.created_at.isoformat(),
        })

    return items


@router.post("/parse-text")
async def parse_text(
    body: TextParseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Parse raw text using AI extractors (TTN, receipts, etc.)."""
    if not body.text or len(body.text.strip()) < 10:
        raise HTTPException(400, "Текст слишком короткий")

    result = parse_text_document(body.text, body.doc_type)

    doc = ScannedDocument(
        organization_id=workspace_organization_id(current_user),
        user_id=current_user.id,
        filename="text_input",
        doc_type=result["doc_type"],
        status="done",
        ocr_text=result.get("ocr_text", ""),
        parsed_data=json.dumps(result.get("parsed", {}), ensure_ascii=False),
        confidence=result.get("confidence", 0),
        lifecycle_status="parsed",
    )
    db.add(doc)
    await db.flush()
    parsed_out = result.get("parsed", {}) or {}
    await emit_document_ocr_processed(
        db,
        workspace_organization_id(current_user),
        doc.id,
        parsed=parsed_out,
        doc_type=result["doc_type"],
        confidence=int(result.get("confidence", 0) or 0),
        linked_transaction_id=None,
        lifecycle_status=doc.lifecycle_status,
        actor="system",
    )
    await db.refresh(doc)

    return {
        "id": doc.id,
        "filename": "text_input",
        "doc_type": result["doc_type"],
        "status": doc.status,
        "confidence": result.get("confidence", 0),
        "ocr_text": result.get("ocr_text", ""),
        "parsed": result.get("parsed", {}),
        "warnings": result.get("warnings", []),
        "lifecycle_status": doc.lifecycle_status,
        "created_at": doc.created_at.isoformat(),
    }


@router.delete("/documents/{doc_id}")
async def delete_scanned_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ScannedDocument).where(
        ScannedDocument.id == doc_id,
        ScannedDocument.organization_id == workspace_organization_id(current_user),
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Документ не найден")
    await db.delete(doc)
    await db.commit()
    return {"ok": True}
