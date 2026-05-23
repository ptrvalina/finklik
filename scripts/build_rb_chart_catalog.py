#!/usr/bin/env python3
"""Сборка chart_of_accounts_rb.json и chart_subaccounts_official_rb.json (Приказ Минфина №50)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend" / "api-gateway"))

from app.data.chart_corpus_instruction50 import ACCOUNTS, RESERVED_NUMBERS, SUBACCOUNTS  # noqa: E402

OUT_ACCOUNTS = ROOT / "backend/api-gateway/app/data/chart_of_accounts_rb.json"
OUT_SUB = ROOT / "backend/api-gateway/app/data/chart_subaccounts_official_rb.json"

PASSIVE_CODES = {
    "02",
    "05",
    "14",
    "42",
    "59",
    "63",
    "65",
    "66",
    "67",
    "69",
    "70",
    "77",
    "80",
    "81",
    "82",
    "83",
    "86",
    "93",
    "95",
    "96",
    "98",
}
ACTIVE_PASSIVE = {"60", "62", "68", "71", "73", "75", "76", "79", "84", "90", "91", "94", "99"}


def account_type(code: str) -> str:
    if len(code) == 3:
        return "off_balance"
    if code in PASSIVE_CODES:
        return "passive"
    if code in ACTIVE_PASSIVE:
        return "active_passive"
    return "active"


def account_class(code: str) -> int:
    if len(code) == 3:
        return 9
    n = int(code)
    if n <= 9:
        return 1
    if n <= 19:
        return 2
    if n <= 39:
        return 3
    if n <= 49:
        return 4
    if n <= 59:
        return 5
    if n <= 79:
        return 6
    if n <= 89:
        return 7
    return 8


def main() -> None:
    accounts = []
    for code, name in ACCOUNTS:
        bt = account_type(code)
        accounts.append(
            {
                "code": code,
                "class": account_class(code),
                "name": name,
                "type": bt,
                "off_balance": bt == "off_balance",
                "optional": False,
            }
        )
    accounts.sort(key=lambda a: (a["class"], a["code"]))

    subaccounts = [{"parent": p, "suffix": s, "name": n} for p, s, n in SUBACCOUNTS]
    subaccounts.sort(key=lambda s: (s["parent"], int(s["suffix"]) if s["suffix"].isdigit() else 0, s["suffix"]))

    meta = {
        "standard": "Постановление Минфина РБ №50 (Приложение 1, Инструкция)",
        "version": "2026-05-23-full",
        "source": "chart_corpus_instruction50.py",
        "accounts_count": len(accounts),
        "subaccounts_count": len(subaccounts),
        "reserved_numbers": sorted(RESERVED_NUMBERS, key=lambda c: (len(c), c)),
    }

    OUT_ACCOUNTS.write_text(
        json.dumps(
            {
                "meta": meta,
                "classes": [
                    {"id": 1, "name": "Долгосрочные активы"},
                    {"id": 2, "name": "Производственные запасы"},
                    {"id": 3, "name": "Затраты на производство"},
                    {"id": 4, "name": "Готовая продукция и товары"},
                    {"id": 5, "name": "Денежные средства и краткосрочные финансовые вложения"},
                    {"id": 6, "name": "Расчёты"},
                    {"id": 7, "name": "Собственный капитал"},
                    {"id": 8, "name": "Финансовые результаты"},
                    {"id": 9, "name": "Забалансовые счета"},
                ],
                "accounts": accounts,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    OUT_SUB.write_text(
        json.dumps(
            {
                "meta": {
                    "standard": "Приказ Минфина РБ №50 — типовые субсчета",
                    "version": "2026-05-23-full",
                    "subaccounts_count": len(subaccounts),
                },
                "subaccounts": subaccounts,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"accounts={len(accounts)} subaccounts={len(subaccounts)} reserved={len(RESERVED_NUMBERS)}")


if __name__ == "__main__":
    main()
