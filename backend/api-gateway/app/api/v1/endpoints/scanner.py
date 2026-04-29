import json
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.document import ScannedDocument
from app.models.transaction import Transaction
from app.services.ocr_service import tesseract_ocr_process, parse_text_document
from app.services.expense_ai_classifier import classify_expense_category

router = APIRouter(prefix="/scanner", tags=["scanner"])


class TextParseRequest(BaseModel):
    text: str
    doc_type: str | None = None

MAX_SIZE = 25 * 1024 * 1024  # 25 MB (как в UI сканера)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"}


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
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 25 МБ)")

    ocr_result = tesseract_ocr_process(file.filename or "doc.jpg", contents, effective_type)

    doc = ScannedDocument(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        filename=file.filename or "unknown",
        doc_type=ocr_result["doc_type"],
        status="done",
        ocr_text=ocr_result.get("ocr_text", ""),
        parsed_data=json.dumps(ocr_result.get("parsed", {}), ensure_ascii=False),
        confidence=ocr_result.get("confidence", 0),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "doc_type": doc.doc_type,
        "status": doc.status,
        "confidence": doc.confidence,
        "ocr_text": doc.ocr_text,
        "parsed": ocr_result.get("parsed", {}),
        "warnings": ocr_result.get("warnings", []),
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
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 25 МБ)")

    ocr_result = tesseract_ocr_process(file.filename or "doc.jpg", contents, effective_type)
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
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        filename=file.filename or "unknown",
        doc_type=ocr_result["doc_type"],
        status="done",
        ocr_text=ocr_result.get("ocr_text", ""),
        parsed_data=json.dumps(parsed, ensure_ascii=False),
        confidence=ocr_result.get("confidence", 0),
    )
    db.add(doc)
    await db.flush()

    tx = Transaction(
        organization_id=current_user.organization_id,
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
    return {
        "document_id": doc.id,
        "transaction_id": tx.id,
        "ai_category": category,
        "ai_category_confidence": confidence,
        "amount": str(tx.amount),
        "source": tx.source,
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
        .where(ScannedDocument.organization_id == current_user.organization_id)
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
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        filename="text_input",
        doc_type=result["doc_type"],
        status="done",
        ocr_text=result.get("ocr_text", ""),
        parsed_data=json.dumps(result.get("parsed", {}), ensure_ascii=False),
        confidence=result.get("confidence", 0),
    )
    db.add(doc)
    await db.commit()
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
        ScannedDocument.organization_id == current_user.organization_id,
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Документ не найден")
    await db.delete(doc)
    await db.commit()
    return {"ok": True}
