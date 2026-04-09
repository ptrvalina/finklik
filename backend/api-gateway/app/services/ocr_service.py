"""
OCR-сервис для распознавания документов.

MVP: mock-распознавание, имитирующее реальный OCR.
В проде заменить на Tesseract / Google Vision / Yandex Vision.
"""
import json
import random
import re
import sys
import os
from datetime import date, timedelta
from decimal import Decimal
from dataclasses import asdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'ai', 'inference', 'app'))
try:
    from ttn_extractor import extract_ttn_data
except ImportError:
    extract_ttn_data = None


def detect_doc_type(filename: str) -> str:
    """Определяет тип документа по имени файла."""
    name = filename.lower()
    if any(k in name for k in ("чек", "check", "receipt", "кассов")):
        return "receipt"
    if any(k in name for k in ("ттн", "ttn", "накладн", "товарн")):
        return "ttn"
    if any(k in name for k in ("акт", "act")):
        return "act"
    if any(k in name for k in ("счёт", "счет", "invoice")):
        return "invoice"
    return "receipt"


def mock_ocr_process(filename: str, file_bytes: bytes) -> dict:
    """
    Имитация OCR-обработки документа.
    Возвращает распознанный текст и структурированные данные.
    """
    doc_type = detect_doc_type(filename)
    size_kb = len(file_bytes) / 1024

    if doc_type == "receipt":
        return _mock_receipt(size_kb)
    elif doc_type == "ttn":
        return _merge_ttn_extractor(_mock_ttn(size_kb))
    elif doc_type == "act":
        return _mock_act(size_kb)
    elif doc_type == "invoice":
        return _mock_invoice(size_kb)
    else:
        return _mock_receipt(size_kb)


def _merge_ttn_extractor(mock_result: dict) -> dict:
    """После mock-OCR прогоняем текст через ttn_extractor (AI-модуль)."""
    if extract_ttn_data is None:
        return mock_result
    try:
        ttn = extract_ttn_data(mock_result.get("ocr_text") or "")
        parsed = dict(mock_result.get("parsed") or {})
        if ttn.total_amount > 0:
            parsed["amount"] = float(ttn.total_amount)
        if ttn.total_vat > 0:
            parsed["vat_amount"] = float(ttn.total_vat)
        if ttn.doc_number:
            parsed["doc_number"] = ttn.doc_number
        if ttn.sender_name:
            parsed["counterparty_name"] = ttn.sender_name
        if ttn.doc_date:
            parsed["transaction_date"] = ttn.doc_date
        if ttn.items:
            parsed["items_count"] = len(ttn.items)
            parsed["items"] = [asdict(item) for item in ttn.items]
        if ttn.unp_sender:
            parsed["unp_sender"] = ttn.unp_sender
        if ttn.unp_receiver:
            parsed["unp_receiver"] = ttn.unp_receiver
        conf = int(ttn.confidence * 100)
        out = {
            **mock_result,
            "parsed": parsed,
            "confidence": max(mock_result.get("confidence") or 0, conf),
        }
        if ttn.warnings:
            out["warnings"] = list(ttn.warnings)
        return out
    except Exception:
        return mock_result


def _mock_receipt(size_kb: float) -> dict:
    amount = round(random.uniform(5.0, 500.0), 2)
    vat = round(amount * 0.2 / 1.2, 2)
    d = date.today() - timedelta(days=random.randint(0, 14))
    shop = random.choice([
        "ОАО Евроопт", "ООО Гиппо", "ЧТУП Алми", "ИП Петров А.В.",
        "ОАО Беларуснефть", "ООО Остров чистоты", "СООО МТС",
    ])
    items_count = random.randint(1, 8)
    confidence = random.randint(82, 97)

    return {
        "doc_type": "receipt",
        "confidence": confidence,
        "ocr_text": f"КАССОВЫЙ ЧЕК\n{shop}\nУНП 123456789\nДата: {d.isoformat()}\nИТОГО: {amount} BYN\nНДС 20%: {vat} BYN",
        "parsed": {
            "type": "expense",
            "amount": amount,
            "vat_amount": vat,
            "description": f"Чек {shop}",
            "transaction_date": d.isoformat(),
            "counterparty_name": shop,
            "items_count": items_count,
        },
    }


def _mock_ttn(size_kb: float) -> dict:
    """Текст совместим с ttn_extractor (таблица позиций, итого, НДС)."""
    d = date.today() - timedelta(days=random.randint(0, 30))
    sender = random.choice(["ОАО Минский молочный завод", "ООО БелПромСервис", "ЧПУП Стройматериалы"])
    receiver = random.choice(["ООО ПромТехСервис", "ИП Петрова А.С.", "ООО Стройком"])
    doc_num = f"ТТН-{random.randint(1000, 9999)}"
    q1, p1 = random.randint(20, 120), round(random.uniform(1.5, 8.0), 2)
    q2, p2 = random.randint(5, 80), round(random.uniform(2.0, 12.0), 2)
    line1 = round(q1 * p1, 2)
    line2 = round(q2 * p2, 2)
    amount = round(line1 + line2, 2)
    vat = round(amount * 0.2 / 1.2, 2)
    items_count = 2
    confidence = random.randint(72, 88)

    ocr_text = f"""ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ № {doc_num}
Грузоотправитель: {sender}
Грузополучатель: {receiver}
Дата: {d.strftime("%d.%m.%Y")}

1  Молоко пастер  л  {q1}  {str(p1).replace(".", ",")}  {str(line1).replace(".", ",")}
2  Сметана дойная  кг  {q2}  {str(p2).replace(".", ",")}  {str(line2).replace(".", ",")}

Итого: {str(amount).replace(".", ",")}
НДС: {str(vat).replace(".", ",")}
"""
    return {
        "doc_type": "ttn",
        "confidence": confidence,
        "ocr_text": ocr_text,
        "parsed": {
            "type": "expense",
            "amount": amount,
            "vat_amount": vat,
            "description": f"{doc_num} — {sender}",
            "transaction_date": d.isoformat(),
            "counterparty_name": sender,
            "doc_number": doc_num,
            "items_count": items_count,
        },
    }


def _mock_act(size_kb: float) -> dict:
    amount = round(random.uniform(100.0, 5000.0), 2)
    vat = round(amount * 0.2 / 1.2, 2)
    d = date.today() - timedelta(days=random.randint(0, 30))
    contractor = random.choice(["ООО Вебразработка", "ИП Сидоров К.Н.", "ОАО Консалт-Плюс"])
    doc_num = f"АКТ-{random.randint(100, 999)}"
    confidence = random.randint(85, 97)

    return {
        "doc_type": "act",
        "confidence": confidence,
        "ocr_text": f"АКТ ВЫПОЛНЕННЫХ РАБОТ № {doc_num}\nИсполнитель: {contractor}\nДата: {d.isoformat()}\nСумма: {amount} BYN\nНДС 20%: {vat} BYN",
        "parsed": {
            "type": "expense",
            "amount": amount,
            "vat_amount": vat,
            "description": f"{doc_num} — {contractor}",
            "transaction_date": d.isoformat(),
            "counterparty_name": contractor,
            "doc_number": doc_num,
        },
    }


def parse_text_document(text: str, doc_type_hint: str | None = None) -> dict:
    """
    Parse raw text using AI extractors.
    Returns structured data from the text.
    """
    doc_type = doc_type_hint or _detect_type_from_text(text)

    if doc_type == "ttn" and extract_ttn_data is not None:
        ttn = extract_ttn_data(text)
        items_data = [asdict(item) for item in ttn.items]
        return {
            "doc_type": "ttn",
            "confidence": int(ttn.confidence * 100),
            "ocr_text": text,
            "parsed": {
                "type": "expense",
                "amount": ttn.total_amount,
                "vat_amount": ttn.total_vat,
                "description": f"ТТН {ttn.doc_number} от {ttn.sender_name}" if ttn.doc_number else "ТТН",
                "transaction_date": ttn.doc_date or date.today().isoformat(),
                "counterparty_name": ttn.sender_name,
                "doc_number": ttn.doc_number,
                "items": items_data,
                "items_count": len(ttn.items),
                "unp_sender": ttn.unp_sender,
                "unp_receiver": ttn.unp_receiver,
                "driver_name": ttn.driver_name,
                "vehicle_number": ttn.vehicle_number,
                "total_amount_text": ttn.total_amount_text,
            },
            "warnings": ttn.warnings,
        }

    return _extract_generic(text, doc_type)


def _detect_type_from_text(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ("товарно-транспортная", "ттн", "грузоотправитель")):
        return "ttn"
    if any(k in t for k in ("кассовый чек", "чек", "итого к оплате")):
        return "receipt"
    if any(k in t for k in ("акт выполненных", "акт приёмки", "акт приемки")):
        return "act"
    if any(k in t for k in ("счёт-фактура", "счет-фактура", "к оплате")):
        return "invoice"
    return "unknown"


def _extract_generic(text: str, doc_type: str) -> dict:
    """Extract basic fields from any document text."""
    amount = 0.0
    vat = 0.0
    doc_date = date.today().isoformat()
    description = ""

    amount_match = re.search(r'(?:итого|сумма|к оплате)[:\s]*([\d\s]+[.,]\d{2})', text, re.IGNORECASE)
    if amount_match:
        try:
            amount = float(re.sub(r'[\s\xa0]', '', amount_match.group(1)).replace(',', '.'))
        except ValueError:
            pass

    vat_match = re.search(r'(?:ндс|НДС)[:\s]*([\d\s]+[.,]\d{2})', text, re.IGNORECASE)
    if vat_match:
        try:
            vat = float(re.sub(r'[\s\xa0]', '', vat_match.group(1)).replace(',', '.'))
        except ValueError:
            pass

    date_match = re.search(r'(\d{2}[./]\d{2}[./]\d{4})', text)
    if date_match:
        parts = re.split(r'[./]', date_match.group(1))
        try:
            doc_date = f"{parts[2]}-{parts[1]}-{parts[0]}"
        except IndexError:
            pass

    first_line = text.strip().split('\n')[0][:100] if text.strip() else "Документ"
    description = first_line

    confidence = 30
    if amount > 0:
        confidence += 30
    if vat > 0:
        confidence += 15
    if date_match:
        confidence += 15

    return {
        "doc_type": doc_type,
        "confidence": min(confidence, 95),
        "ocr_text": text,
        "parsed": {
            "type": "expense",
            "amount": amount,
            "vat_amount": vat,
            "description": description,
            "transaction_date": doc_date,
        },
        "warnings": [] if amount > 0 else ["Не удалось извлечь сумму из текста"],
    }


def _mock_invoice(size_kb: float) -> dict:
    amount = round(random.uniform(50.0, 8000.0), 2)
    vat = round(amount * 0.2 / 1.2, 2)
    d = date.today() - timedelta(days=random.randint(0, 14))
    company = random.choice(["ООО Техноснаб", "ОАО ПромИнвест", "ЧТУП Офис-Сервис"])
    doc_num = f"СФ-{random.randint(100, 9999)}"
    confidence = random.randint(88, 98)

    return {
        "doc_type": "invoice",
        "confidence": confidence,
        "ocr_text": f"СЧЁТ-ФАКТУРА № {doc_num}\nПоставщик: {company}\nДата: {d.isoformat()}\nК оплате: {amount} BYN\nВ т.ч. НДС 20%: {vat} BYN",
        "parsed": {
            "type": "expense",
            "amount": amount,
            "vat_amount": vat,
            "description": f"Счёт {doc_num} — {company}",
            "transaction_date": d.isoformat(),
            "counterparty_name": company,
            "doc_number": doc_num,
        },
    }
