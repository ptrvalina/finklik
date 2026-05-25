import json
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.deps import get_current_user, workspace_organization_id
from app.models.user import User
from app.models.document import ScannedDocument
from app.models.transaction import Transaction
from app.services.ocr_service import tesseract_ocr_process, parse_text_document
from app.services.expense_ai_classifier import classify_expense_category
from app.internal.audit.service import safe_log_audit
from app.events.emit import emit_document_ocr_processed, emit_ocr_linked, emit_transaction_created
from app.services.financial_state_service import refresh_financial_state_audit
from app.security.upload_validation import bytes_match_declared_type, sanitize_upload_filename
from app.security.metrics import OCR_FAILED_TOTAL, UPLOAD_REJECTED_TOTAL

router = APIRouter(prefix="/scanner", tags=["scanner"])


class TextParseRequest(BaseModel):
    text: str
    doc_type: str | None = None


class OcrCorrectionFields(BaseModel):
    doc_type: str | None = None
    counterparty_name: str | None = None
    transaction_date: str | None = None
    amount: str | float | None = None
    vat_amount: str | float | None = None
    type: str | None = None
    description: str | None = None
    category: str | None = None
    debit_account: str | None = None
    credit_account: str | None = None
    corrected_fields: list[str] = Field(default_factory=list)


def _parse_doc_json(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _apply_correction_fields(parsed: dict, body: OcrCorrectionFields) -> dict:
    out = dict(parsed)
    if body.counterparty_name is not None:
        out["counterparty_name"] = body.counterparty_name.strip()
    if body.transaction_date is not None:
        out["transaction_date"] = body.transaction_date
    if body.amount is not None:
        out["amount"] = float(_to_decimal(body.amount))
    if body.vat_amount is not None:
        out["vat_amount"] = float(_to_decimal(body.vat_amount))
    if body.type is not None:
        out["type"] = body.type
    if body.description is not None:
        out["description"] = body.description.strip()
    return out


def _bump_field_confidence(fc: dict[str, int], corrected: list[str]) -> dict[str, int]:
    updated = dict(fc)
    for key in corrected:
        updated[key] = max(int(updated.get(key, 0) or 0), 95)
    return updated


def _still_needs_review(confidence: int, fc: dict[str, int]) -> bool:
    if confidence < LOW_CONFIDENCE_THRESHOLD:
        return True
    return any(int(v) < LOW_CONFIDENCE_THRESHOLD for v in fc.values())


async def _document_payload(db: AsyncSession, doc: ScannedDocument, oid: str) -> dict:
    parsed = _parse_doc_json(doc.parsed_data)
    fc = _load_field_confidence(doc.field_confidence_json)
    payload = _scan_result_payload(
        doc,
        parsed,
        linked_transaction_id=doc.transaction_id,
        field_confidence=fc,
    )
    cp_name = (parsed.get("counterparty_name") or "").strip()
    if cp_name:
        try:
            from app.services.vendor_memory_service import lookup_vendor_hints

            hints = await lookup_vendor_hints(db, oid, cp_name)
            if hints:
                payload["vendor_hints"] = hints
        except Exception:
            pass
    try:
        from app.services.ocr_execution_service import build_execution_suggestions

        payload["execution_suggestions"] = await build_execution_suggestions(
            db,
            oid,
            parsed=parsed,
            doc_type=doc.doc_type,
            vendor_hints=payload.get("vendor_hints"),
            requires_review=bool(doc.requires_review),
            linked_transaction_id=doc.transaction_id,
        )
    except Exception:
        pass
    return payload

MAX_SIZE = 25 * 1024 * 1024  # 25 MB (как в UI сканера)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"}
LOW_CONFIDENCE_THRESHOLD = 75


def _load_field_confidence(raw: str | None) -> dict[str, int]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return {str(k): int(v) for k, v in data.items() if v is not None}
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return {}


def _scan_result_payload(
    doc: ScannedDocument,
    parsed: dict,
    *,
    warnings: list | None = None,
    is_duplicate: bool = False,
    linked_transaction_id: str | None = None,
    field_confidence: dict | None = None,
) -> dict:
    fc = field_confidence if field_confidence is not None else _load_field_confidence(doc.field_confidence_json)
    regions = parsed.get("_field_regions") if isinstance(parsed.get("_field_regions"), dict) else {}
    public_parsed = {k: v for k, v in parsed.items() if not str(k).startswith("_")}
    return {
        "id": doc.id,
        "filename": doc.filename,
        "doc_type": doc.doc_type,
        "status": doc.status,
        "confidence": doc.confidence,
        "requires_review": bool(doc.requires_review),
        "field_confidence": fc,
        "field_regions": regions,
        "ocr_text": doc.ocr_text,
        "parsed": public_parsed,
        "warnings": warnings or [],
        "is_duplicate": is_duplicate,
        "linked_transaction_id": linked_transaction_id,
        "lifecycle_status": doc.lifecycle_status,
        "created_at": doc.created_at.isoformat(),
    }


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
        UPLOAD_REJECTED_TOTAL.labels(endpoint="scanner_upload").inc()
        raise HTTPException(
            400,
            f"Неподдерживаемый формат: {file.content_type or 'не указан'}. Разрешены: JPEG, PNG, WebP, HEIC, PDF",
        )

    contents = await file.read()
    if not contents:
        UPLOAD_REJECTED_TOTAL.labels(endpoint="scanner_upload").inc()
        raise HTTPException(400, "Пустой файл")
    if len(contents) > MAX_SIZE:
        UPLOAD_REJECTED_TOTAL.labels(endpoint="scanner_upload").inc()
        raise HTTPException(400, "Файл слишком большой (макс. 25 МБ)")
    if not bytes_match_declared_type(contents, effective_type):
        UPLOAD_REJECTED_TOTAL.labels(endpoint="scanner_upload").inc()
        raise HTTPException(
            400,
            "Содержимое файла не совпадает с допустимым форматом (JPEG, PNG, WebP, HEIC, PDF). Учёт не изменён.",
        )

    safe_filename = sanitize_upload_filename(file.filename)
    try:
        ocr_result = tesseract_ocr_process(safe_filename or "doc.jpg", contents, effective_type)
    except Exception:
        OCR_FAILED_TOTAL.labels(endpoint="scanner_upload").inc()
        raise HTTPException(
            503,
            "Распознавание временно не завершилось. Попробуйте загрузить файл ещё раз — данные учёта не изменены.",
        ) from None
    parsed = dict(ocr_result.get("parsed", {}) or {})
    if ocr_result.get("field_regions"):
        parsed["_field_regions"] = ocr_result["field_regions"]
    linked_tx_id, is_duplicate = await _find_duplicate_or_linked_transaction(
        db=db,
        organization_id=workspace_organization_id(current_user),
        parsed=parsed,
    )

    needs_review = bool(ocr_result.get("requires_review")) or int(ocr_result.get("confidence", 0)) < LOW_CONFIDENCE_THRESHOLD
    doc = ScannedDocument(
        organization_id=workspace_organization_id(current_user),
        user_id=current_user.id,
        filename=safe_filename,
        doc_type=ocr_result["doc_type"],
        status="needs_review" if needs_review else "done",
        ocr_text=ocr_result.get("ocr_text", ""),
        parsed_data=json.dumps(parsed, ensure_ascii=False),
        confidence=ocr_result.get("confidence", 0),
        requires_review=needs_review,
        field_confidence_json=json.dumps(ocr_result.get("field_confidence") or {}, ensure_ascii=False),
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
    oid = workspace_organization_id(current_user)
    vendor_hints = None
    cp_name = (parsed.get("counterparty_name") or "").strip()
    if cp_name:
        try:
            from app.services.vendor_memory_service import lookup_vendor_hints, remember_vendor

            vendor_hints = await lookup_vendor_hints(db, oid, cp_name)
            await remember_vendor(db, oid, display_name=cp_name, unp=parsed.get("unp"))
            vendor_hints = vendor_hints or await lookup_vendor_hints(db, oid, cp_name)
        except Exception:
            vendor_hints = None
    await refresh_financial_state_audit(db, oid)

    payload = _scan_result_payload(
        doc,
        parsed,
        warnings=ocr_result.get("warnings", []),
        is_duplicate=is_duplicate,
        linked_transaction_id=linked_tx_id,
        field_confidence=ocr_result.get("field_confidence") or {},
    )
    if vendor_hints:
        payload["vendor_hints"] = vendor_hints

    try:
        from app.services.ocr_execution_service import build_execution_suggestions
        from app.services.pilot_analytics_service import track_pilot_event

        payload["execution_suggestions"] = await build_execution_suggestions(
            db,
            oid,
            parsed=parsed,
            doc_type=doc.doc_type,
            vendor_hints=vendor_hints,
            requires_review=needs_review,
            linked_transaction_id=linked_tx_id,
        )
        await track_pilot_event(
            db,
            organization_id=oid,
            user_id=str(current_user.id),
            event_name="ocr_scan_completed",
            payload={"doc_type": doc.doc_type, "requires_review": needs_review},
        )
    except Exception:
        pass

    if ocr_result.get("doc_type_confidence"):
        payload["doc_type_confidence"] = ocr_result.get("doc_type_confidence")
    if ocr_result.get("field_validation"):
        payload["field_validation"] = ocr_result.get("field_validation")
    return payload


@router.post("/upload-to-kudir")
async def upload_to_kudir(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    effective_type = _normalize_upload_content_type(file.content_type, file.filename or "")
    if effective_type not in ALLOWED_TYPES:
        UPLOAD_REJECTED_TOTAL.labels(endpoint="scanner_kudir").inc()
        raise HTTPException(400, "Неподдерживаемый формат файла")

    contents = await file.read()
    if not contents:
        UPLOAD_REJECTED_TOTAL.labels(endpoint="scanner_kudir").inc()
        raise HTTPException(400, "Пустой файл")
    if len(contents) > MAX_SIZE:
        UPLOAD_REJECTED_TOTAL.labels(endpoint="scanner_kudir").inc()
        raise HTTPException(400, "Файл слишком большой (макс. 25 МБ)")
    if not bytes_match_declared_type(contents, effective_type):
        UPLOAD_REJECTED_TOTAL.labels(endpoint="scanner_kudir").inc()
        raise HTTPException(
            400,
            "Содержимое файла не совпадает с допустимым форматом. Проводка не создана.",
        )

    safe_filename = sanitize_upload_filename(file.filename)
    try:
        ocr_result = tesseract_ocr_process(safe_filename or "doc.jpg", contents, effective_type)
    except Exception:
        OCR_FAILED_TOTAL.labels(endpoint="scanner_kudir").inc()
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
        filename=safe_filename,
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
        description=parsed.get("description") or f"Скан {safe_filename}".strip(),
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
    await refresh_financial_state_audit(db, oid)
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
            "requires_review": bool(d.requires_review),
            "field_confidence": _load_field_confidence(d.field_confidence_json),
            "parsed": parsed,
            "transaction_id": d.transaction_id,
            "lifecycle_status": d.lifecycle_status,
            "created_at": d.created_at.isoformat(),
        })

    return items


@router.get("/documents/{doc_id}")
async def get_scanned_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = workspace_organization_id(current_user)
    result = await db.execute(
        select(ScannedDocument).where(
            ScannedDocument.id == doc_id,
            ScannedDocument.organization_id == oid,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Документ не найден")
    return await _document_payload(db, doc, oid)


@router.patch("/documents/{doc_id}/corrections")
async def patch_scanned_corrections(
    doc_id: str,
    body: OcrCorrectionFields,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Мгновенное сохранение правок OCR + обучение vendor memory."""
    oid = workspace_organization_id(current_user)
    result = await db.execute(
        select(ScannedDocument).where(
            ScannedDocument.id == doc_id,
            ScannedDocument.organization_id == oid,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Документ не найден")

    parsed = _apply_correction_fields(_parse_doc_json(doc.parsed_data), body)
    fc = _bump_field_confidence(_load_field_confidence(doc.field_confidence_json), body.corrected_fields)
    if body.doc_type:
        doc.doc_type = body.doc_type

    doc.parsed_data = json.dumps(parsed, ensure_ascii=False)
    doc.field_confidence_json = json.dumps(fc, ensure_ascii=False)
    doc.requires_review = _still_needs_review(int(doc.confidence or 0), fc)
    doc.status = "needs_review" if doc.requires_review else "done"
    await db.flush()

    cp_name = (parsed.get("counterparty_name") or "").strip()
    if cp_name and body.corrected_fields:
        try:
            from app.services.vendor_memory_service import remember_vendor

            await remember_vendor(
                db,
                oid,
                display_name=cp_name,
                category=body.category,
                debit_account=body.debit_account,
                credit_account=body.credit_account,
            )
        except Exception:
            pass

    try:
        from app.services.pilot_analytics_service import track_pilot_event

        await track_pilot_event(
            db,
            organization_id=oid,
            user_id=str(current_user.id),
            event_name="ocr_field_edited",
            payload={"doc_id": doc_id, "fields": body.corrected_fields},
        )
    except Exception:
        pass

    await refresh_financial_state_audit(db, oid)
    await db.refresh(doc)
    return await _document_payload(db, doc, oid)


@router.post("/documents/{doc_id}/confirm-transaction")
async def confirm_scanned_transaction(
    doc_id: str,
    body: OcrCorrectionFields,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """OCR → учёт: правки, операция в журнале, связь документа."""
    oid = workspace_organization_id(current_user)
    result = await db.execute(
        select(ScannedDocument).where(
            ScannedDocument.id == doc_id,
            ScannedDocument.organization_id == oid,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Документ не найден")
    if doc.transaction_id:
        payload = await _document_payload(db, doc, oid)
        return {
            "transaction_id": doc.transaction_id,
            "document_id": doc.id,
            "already_linked": True,
            **payload,
        }

    parsed = _apply_correction_fields(_parse_doc_json(doc.parsed_data), body)
    amount = _to_decimal(parsed.get("amount"))
    if amount <= 0:
        raise HTTPException(400, "Укажите сумму больше 0")
    try:
        tx_date = date.fromisoformat(str(parsed.get("transaction_date")))
    except Exception:
        tx_date = date.today()

    vat_amount = _to_decimal(parsed.get("vat_amount"))
    category = body.category
    ai_conf = Decimal("0.85")
    if not category:
        category, conf_raw = classify_expense_category(
            f"{parsed.get('description', '')}\n{parsed.get('counterparty_name', '')}\n{doc.ocr_text or ''}"
        )
        ai_conf = Decimal(str(conf_raw))

    fc = _bump_field_confidence(_load_field_confidence(doc.field_confidence_json), body.corrected_fields)
    if body.doc_type:
        doc.doc_type = body.doc_type
    doc.parsed_data = json.dumps(parsed, ensure_ascii=False)
    doc.field_confidence_json = json.dumps(fc, ensure_ascii=False)
    doc.requires_review = False
    doc.status = "done"

    cp_name = (parsed.get("counterparty_name") or "").strip()
    label = doc.doc_type or "document"
    desc = (parsed.get("description") or "").strip() or (f"{label}: {cp_name}" if cp_name else f"Скан {doc.filename}")

    tx = Transaction(
        organization_id=oid,
        type=parsed.get("type") or "expense",
        amount=amount,
        vat_amount=vat_amount if vat_amount >= 0 else Decimal("0"),
        category=category,
        description=desc[:500],
        transaction_date=tx_date,
        source="scan",
        ai_category_confidence=ai_conf,
        receipt_image_url=f"scanned://{doc.id}/{doc.filename}",
    )
    db.add(tx)
    await db.flush()

    doc.transaction_id = tx.id
    doc.lifecycle_status = "confirmed"
    await db.flush()

    if cp_name:
        try:
            from app.services.vendor_memory_service import remember_vendor

            await remember_vendor(
                db,
                oid,
                display_name=cp_name,
                category=category,
                debit_account=body.debit_account,
                credit_account=body.credit_account,
            )
        except Exception:
            pass

    await emit_ocr_linked(db, oid, doc.id, transaction_id=tx.id)
    await emit_transaction_created(db, oid, tx, actor="user")
    await safe_log_audit(
        db,
        user_id=str(current_user.id),
        action="scan_confirmed_to_journal",
        entity_type="transaction",
        entity_id=str(tx.id),
        metadata={"document_id": str(doc.id), "source": tx.source},
    )
    await refresh_financial_state_audit(db, oid)
    await db.refresh(doc)

    payload = await _document_payload(db, doc, oid)
    return {
        "transaction_id": tx.id,
        "document_id": doc.id,
        "already_linked": False,
        **payload,
    }


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
    parsed_out = result.get("parsed", {}) or {}
    needs_review = bool(result.get("requires_review")) or int(result.get("confidence", 0)) < LOW_CONFIDENCE_THRESHOLD

    doc = ScannedDocument(
        organization_id=workspace_organization_id(current_user),
        user_id=current_user.id,
        filename="text_input",
        doc_type=result["doc_type"],
        status="needs_review" if needs_review else "done",
        ocr_text=result.get("ocr_text", ""),
        parsed_data=json.dumps(parsed_out, ensure_ascii=False),
        confidence=result.get("confidence", 0),
        requires_review=needs_review,
        field_confidence_json=json.dumps(result.get("field_confidence") or {}, ensure_ascii=False),
        lifecycle_status="parsed",
    )
    db.add(doc)
    await db.flush()
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
    await refresh_financial_state_audit(db, workspace_organization_id(current_user))

    return _scan_result_payload(
        doc,
        parsed_out,
        warnings=result.get("warnings", []),
        field_confidence=result.get("field_confidence") or {},
    )


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
    oid = doc.organization_id
    await db.delete(doc)
    await db.flush()
    await refresh_financial_state_audit(db, oid)
    return {"ok": True}
