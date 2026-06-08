from app.services.product_contour import (
    is_tax_regime_valid,
    resolve_product_contour,
    suggested_accounting_mode,
)


def test_ip_single_tax_contour():
    c = resolve_product_contour("ip", "single_tax")
    assert c["id"] == "ip_single_tax"
    assert c["features"]["kudir"] is False
    assert c["features"]["single_tax"] is True


def test_ip_legacy_maps_to_single_tax():
    c = resolve_product_contour("ip", "osn_vat")
    assert c["id"] == "ip_single_tax"


def test_ooo_usn_with_kudir():
    c = resolve_product_contour("ooo", "usn_no_vat")
    assert c["id"] == "org_usn"
    assert c["features"]["usn"] is True
    assert c["features"]["kudir"] is True
    assert c["features"]["chart_of_accounts"] is False


def test_org_legacy_osn_maps_to_usn():
    c = resolve_product_contour("chup", "osn_vat")
    assert c["id"] == "org_usn"
    assert c["features"]["kudir"] is True
    assert suggested_accounting_mode("chup", "osn_vat") == "simple"


def test_tax_validation_mvp():
    assert is_tax_regime_valid("ip", "single_tax")
    assert is_tax_regime_valid("ooo", "usn_no_vat")
    assert is_tax_regime_valid("ooo", "osn_vat")  # legacy в БД
    assert not is_tax_regime_valid("ip", "usn_vat")
