"""Парсинг текста OCR под документы и реквизиты РБ."""

from __future__ import annotations

import re
from datetime import date
from typing import Any

DOC_PATTERNS: list[tuple[str, list[str]]] = [
    ("receipt", ["кассов", "чек", "фискальн", "итого", "сумма"]),
    ("invoice", ["счёт", "счет", "invoice", "счет-фактур"]),
    ("act", ["акт выполнен", "акт оказан", "акт приём"]),
    ("payment_order", ["платёжное поручение", "платежное поручение"]),
    ("ttn", ["ттн", "товарно-транспорт", "накладн"]),
]

UNP_RE = re.compile(r"\bУНП\s*[:№]?\s*(\d{9})\b", re.I)
BYN_RE = re.compile(
    r"(?:итого|сумма|всего|amount)\s*[:=]?\s*([\d\s]+[.,]\d{2})\s*(?:byn|бел\.?\s*руб|руб)?",
    re.I,
)
DATE_RE = re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b")
IP_RE = re.compile(r"\bИП\s+([А-ЯЁа-яё][^\n,]{3,60})", re.I)
OOO_RE = re.compile(r"\b(ООО|ОДО|ЧУП|ОАО|ЗАО)\s+([«\"]?[А-ЯЁA-Za-z0-9][^,\n«»\"]{2,80})", re.I)


def detect_document_type(text: str, filename: str = "") -> str:
    blob = f"{filename}\n{text}".lower()
    for doc_type, keys in DOC_PATTERNS:
        if any(k in blob for k in keys):
            return doc_type
    return "unknown"


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

    m_amt = BYN_RE.search(text)
    if m_amt:
        fields["amount"] = _parse_amount(m_amt.group(1))
        conf["amount"] = 75

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


def build_confidence_result(
    overall: int,
    field_confidence: dict[str, int],
    *,
    threshold_review: int = 72,
) -> dict[str, Any]:
    requires_review = overall < threshold_review or any(v < 60 for v in field_confidence.values())
    return {
        "confidence": overall,
        "field_confidence": field_confidence,
        "requires_review": requires_review,
    }
