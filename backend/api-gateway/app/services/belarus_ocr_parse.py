"""Парсинг текста OCR под документы и реквизиты РБ."""

from __future__ import annotations

import re
from datetime import date
from typing import Any

DOC_PATTERNS: list[tuple[str, list[str]]] = [
    ("receipt", ["кассов", "чек", "фискальн", "итого", "сумма"]),
    ("invoice", ["счёт", "счет", "invoice", "счет-фактур"]),
    ("act", ["акт выполнен", "акт оказан", "акт приём"]),
    ("payment_order", ["платёжное поручение", "платежное поручение", "плательщик", "получатель"]),
    ("kudir", ["кудир", "книга учета", "книга учёта", "доходов и расходов", "доходы и расходы"]),
    ("ttn", ["ттн", "товарно-транспорт", "накладн"]),
    ("contract", ["договор", "контракт", "contract"]),
    ("payroll", ["расчётн", "расчетн", "ведомост", "зарплат", "фсзн"]),
]

PAYMENT_AMOUNT_RE = re.compile(
    r"(?:сумма|amount)\s*[:=]?\s*([\d\s]+[.,]\d{2})",
    re.I,
)

UNP_RE = re.compile(r"\bУНП\s*[:№]?\s*(\d{9})\b", re.I)
BYN_RE = re.compile(
    r"(?:итого|сумма|всего|amount)\s*[:=]?\s*([\d\s]+[.,]\d{2})\s*(?:byn|бел\.?\s*руб|руб)?",
    re.I,
)
DATE_RE = re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b")
IP_RE = re.compile(r"\bИП\s+([А-ЯЁа-яё][^\n,]{3,60})", re.I)
OOO_RE = re.compile(r"\b(ООО|ОДО|ЧУП|ОАО|ЗАО)\s+([«\"]?[А-ЯЁA-Za-z0-9][^,\n«»\"]{2,80})", re.I)
KUDIR_INCOME_RE = re.compile(
    r"(?:доходы|выручка|поступлени[яе])\s*[:=]?\s*([\d\s]+[.,]\d{2})",
    re.I,
)


def detect_document_type(text: str, filename: str = "") -> tuple[str, int]:
    """Тип документа и уверенность классификации 0–100."""
    blob = f"{filename}\n{text}".lower()
    best_type = "unknown"
    best_score = 0
    for doc_type, keys in DOC_PATTERNS:
        hits = sum(1 for k in keys if k in blob)
        if hits > best_score:
            best_score = hits
            best_type = doc_type
    if best_type == "unknown":
        return best_type, 25
    confidence = min(95, 55 + best_score * 12)
    return best_type, confidence


def detect_document_type_legacy(text: str, filename: str = "") -> str:
    doc_type, _ = detect_document_type(text, filename)
    return doc_type


def _parse_amount(raw: str) -> float:
    s = raw.replace(" ", "").replace(",", ".")
    try:
        return round(float(s), 2)
    except ValueError:
        return 0.0


def parse_belarus_fields(text: str) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    conf: dict[str, int] = {}

    m_unp = UNP_RE.search(text)
    if m_unp:
        fields["unp"] = m_unp.group(1)
        conf["unp"] = 88

    pay_match = PAYMENT_AMOUNT_RE.search(text)
    kudir_match = KUDIR_INCOME_RE.search(text)
    m_amt = BYN_RE.search(text) or pay_match or kudir_match
    if m_amt:
        fields["amount"] = _parse_amount(m_amt.group(1))
        conf["amount"] = 78 if pay_match else (76 if kudir_match else 75)

    for m in DATE_RE.finditer(text):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000
        try:
            fields["transaction_date"] = date(y, mo, d).isoformat()
            conf["transaction_date"] = 70
            break
        except ValueError:
            continue

    m_ip = IP_RE.search(text)
    if m_ip:
        fields["counterparty_name"] = f"ИП {m_ip.group(1).strip()}"
        conf["counterparty_name"] = 72
    else:
        m_ooo = OOO_RE.search(text)
        if m_ooo:
            fields["counterparty_name"] = f"{m_ooo.group(1)} {m_ooo.group(2).strip()}"
            conf["counterparty_name"] = 70

    return {"fields": fields, "field_confidence": conf}


def validate_extracted_fields(fields: dict[str, Any], field_confidence: dict[str, int]) -> dict[str, Any]:
    """Мягкая валидация: предупреждения и validation_state по полям."""
    warnings: list[str] = []
    validation: dict[str, str] = {}
    amount = fields.get("amount")
    vat = fields.get("vat_amount") or fields.get("vat")
    if amount and vat:
        try:
            a, v = float(amount), float(vat)
            if a > 0 and v > a * 0.3:
                warnings.append("НДС выглядит завышенным относительно суммы")
                validation["vat_amount"] = "suspicious"
        except (TypeError, ValueError):
            pass
    if fields.get("counterparty_name") and not fields.get("unp"):
        if field_confidence.get("counterparty_name", 0) >= 60:
            warnings.append("Контрагент без УНП — проверьте реквизиты")
            validation["unp"] = "missing"
    if not amount or float(amount or 0) <= 0:
        validation["amount"] = "missing"
    else:
        validation["amount"] = "ok" if field_confidence.get("amount", 0) >= 70 else "low_confidence"
    for key, conf in field_confidence.items():
        if key not in validation:
            validation[key] = "ok" if conf >= 70 else "low_confidence"
    return {"warnings": warnings, "field_validation": validation}


def build_confidence_result(
    overall: int,
    field_confidence: dict[str, int],
    *,
    fields: dict[str, Any] | None = None,
    threshold_review: int = 72,
) -> dict[str, Any]:
    validation_pack = validate_extracted_fields(fields or {}, field_confidence)
    requires_review = (
        overall < threshold_review
        or any(v < 60 for v in field_confidence.values())
        or bool(validation_pack["warnings"])
    )
    return {
        "confidence": overall,
        "field_confidence": field_confidence,
        "requires_review": requires_review,
        "warnings": validation_pack["warnings"],
        "field_validation": validation_pack["field_validation"],
    }
