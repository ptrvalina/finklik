"""Адаптивный контур продукта — MVP без общей системы налогообложения."""

from __future__ import annotations

from typing import TypedDict

LEGAL_FORMS = frozenset({"ip", "chup", "ooo", "kfh", "odo", "self_employed"})

# MVP: osn_vat оставлен только для legacy-записей в БД (маппится в org_usn / single_tax)
TAX_MODES_BY_FORM: dict[str, frozenset[str]] = {
    "ip": frozenset({"single_tax", "usn_no_vat", "osn_vat"}),
    "chup": frozenset({"usn_no_vat", "usn_vat", "osn_vat"}),
    "ooo": frozenset({"usn_no_vat", "usn_vat", "osn_vat"}),
    "kfh": frozenset({"usn_no_vat", "usn_vat", "osn_vat"}),
    "odo": frozenset({"usn_no_vat", "usn_vat", "osn_vat"}),
    "self_employed": frozenset({"usn_no_vat"}),
}

TAX_REGIME_LABELS = {
    "usn_no_vat": "УСН без НДС",
    "usn_vat": "УСН с НДС",
    "osn_vat": "УСН (ранее общая система)",
    "single_tax": "Единый налог",
}

LEGAL_FORM_LABELS = {
    "ip": "ИП",
    "ooo": "ООО",
    "odo": "ОДО",
    "chup": "ЧУП",
    "kfh": "КФХ",
    "self_employed": "Самозанятый",
}


class ProductFeatures(TypedDict):
    kudir: bool
    chart_of_accounts: bool
    fixed_assets: bool
    full_ledger: bool
    single_tax: bool
    usn: bool
    income_tax: bool
    employees: bool
    counterparties: bool
    documents: bool
    reporting: bool


_CONTOUR_FEATURES: dict[str, ProductFeatures] = {
    "ip_single_tax": {
        "kudir": False,
        "chart_of_accounts": False,
        "fixed_assets": False,
        "full_ledger": False,
        "single_tax": True,
        "usn": False,
        "income_tax": False,
        "employees": True,
        "counterparties": True,
        "documents": True,
        "reporting": True,
    },
    "org_usn": {
        "kudir": True,
        "chart_of_accounts": False,
        "fixed_assets": False,
        "full_ledger": False,
        "single_tax": False,
        "usn": True,
        "income_tax": False,
        "employees": True,
        "counterparties": True,
        "documents": True,
        "reporting": True,
    },
    "lightweight": {
        "kudir": False,
        "chart_of_accounts": False,
        "fixed_assets": False,
        "full_ledger": False,
        "single_tax": False,
        "usn": True,
        "income_tax": False,
        "employees": False,
        "counterparties": False,
        "documents": True,
        "reporting": True,
    },
}


def normalize_legal_form(value: str | None) -> str:
    v = (value or "ip").strip().lower()
    return v if v in LEGAL_FORMS else "ip"


def is_tax_regime_valid(legal_form: str, tax_regime: str) -> bool:
    form = normalize_legal_form(legal_form)
    tax = (tax_regime or "").strip().lower()
    allowed = TAX_MODES_BY_FORM.get(form, TAX_MODES_BY_FORM["ip"])
    return tax in allowed


def resolve_product_contour(legal_form: str | None, tax_regime: str | None) -> dict:
    form = normalize_legal_form(legal_form)

    if form == "self_employed":
        contour_id = "lightweight"
        accounting_mode = "simple"
    elif form == "ip":
        contour_id = "ip_single_tax"
        accounting_mode = "simple"
    else:
        contour_id = "org_usn"
        accounting_mode = "simple"

    return {
        "id": contour_id,
        "accounting_mode": accounting_mode,
        "features": _CONTOUR_FEATURES[contour_id],
    }


def suggested_accounting_mode(legal_form: str | None, tax_regime: str | None) -> str:
    return resolve_product_contour(legal_form, tax_regime)["accounting_mode"]
