from __future__ import annotations

from typing import Tuple


_RULES: dict[str, tuple[str, ...]] = {
    "rent": ("аренда", "офис", "помещен"),
    "taxes": ("налог", "фсзн", "ндс", "подоход"),
    "marketing": ("реклама", "ads", "маркетинг", "продвиж"),
    "materials": ("материал", "сырье", "закупка", "товар"),
    "transport": ("топливо", "бензин", "доставка", "перевоз"),
}


def classify_expense_category(text: str | None) -> Tuple[str, float]:
    haystack = (text or "").lower()
    if not haystack.strip():
        return "other", 0.51

    for category, keywords in _RULES.items():
        if any(keyword in haystack for keyword in keywords):
            return category, 0.84
    return "other", 0.58
