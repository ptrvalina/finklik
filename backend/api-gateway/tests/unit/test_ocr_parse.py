"""Разбор сумм из OCR-текста чеков (без интеграции с API)."""
from app.services.ocr_service import (
    parse_counterparty_from_text,
    parse_total_amount_from_text,
    parse_vat_amount_from_text,
    _extract_generic,
)


def test_parse_total_integer_with_spaces():
    text = """
    Товарный чек № 578
    Итого: 44 500
    """
    assert parse_total_amount_from_text(text) == 44500.0


def test_parse_total_with_decimals():
    text = "Итого: 1 234,56\n"
    assert parse_total_amount_from_text(text) == 1234.56


def test_parse_total_plain_integer():
    text = "Итого: 44500\n"
    assert parse_total_amount_from_text(text) == 44500.0


def test_parse_total_two_decimal_places():
    assert parse_total_amount_from_text("Итого: 45,60\n") == 45.60


def test_parse_vat_decimals():
    text = "НДС: 7 416,67\n"
    assert parse_vat_amount_from_text(text) == 7416.67


def test_extract_generic_receipt_warning_cleared():
    text = "ООО Ромашка\nИтого: 44 500\n"
    out = _extract_generic(text, "receipt")
    assert out["parsed"]["amount"] == 44500.0
    assert "Не удалось извлечь сумму" not in " ".join(out.get("warnings", []))


def test_parse_total_multiline_after_ito():
    text = "Товарный чек\nИтого:\n44 500\n"
    assert parse_total_amount_from_text(text) == 44500.0


def test_parse_total_na_summu_rub():
    text = "Всего на сумму 44 500 руб. 00 коп.\n"
    assert parse_total_amount_from_text(text) == 44500.0


def test_parse_counterparty_org_name():
    text = 'Наименование организации: ООО «Ромашка»\nИтого: 100\n'
    assert "Ромашка" in parse_counterparty_from_text(text)
    out = _extract_generic(text, "receipt")
    assert out["parsed"].get("counterparty_name")
    assert "Ромашка" in (out["parsed"].get("counterparty_name") or "")
