"""
Расчёт налогов по белорусскому законодательству.

УСН: ставки 3% (с НДС) и 5% (без НДС)
НДС: 20% (основная), 10% (продукты/лекарства), 0% (экспорт)
ФСЗН: 34% (наниматель) + 1% (работник)
НДФЛ: 13% (с вычетами на детей)

Дедлайны (2024–2025):
  УСН:   25 числа месяца, следующего за кварталом
  НДС:   20 числа месяца, следующего за отчётным
  ФСЗН:  15 числа месяца, следующего за кварталом
"""
import json
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


CENT = Decimal("0.01")

# Ставки налогов
USN_RATE_WITH_VAT = Decimal("0.03")    # 3% с НДС
USN_RATE_WITHOUT_VAT = Decimal("0.05") # 5% без НДС
VAT_RATE = Decimal("0.20")             # 20%
FSSZN_EMPLOYER = Decimal("0.34")       # 34%
FSSZN_EMPLOYEE = Decimal("0.01")       # 1%
INCOME_TAX_RATE = Decimal("0.13")      # 13%

# Стандартный вычет по НДФЛ (BYN/мес, 2024)
CHILD_DEDUCTION_1_2 = Decimal("37")    # на 1-го и 2-го ребёнка
CHILD_DEDUCTION_3_PLUS = Decimal("70") # на 3-го и более


@dataclass(frozen=True)
class TaxRules:
    year: int
    version: str
    usn_rate_with_vat: Decimal
    usn_rate_without_vat: Decimal
    vat_rate: Decimal
    fsszn_employer: Decimal
    fsszn_employee: Decimal


_DEFAULT_TAX_RULES_BY_YEAR: dict[int, TaxRules] = {
    2024: TaxRules(
        year=2024,
        version="RB-TAX-2024.1",
        usn_rate_with_vat=Decimal("0.03"),
        usn_rate_without_vat=Decimal("0.05"),
        vat_rate=Decimal("0.20"),
        fsszn_employer=Decimal("0.34"),
        fsszn_employee=Decimal("0.01"),
    ),
    2025: TaxRules(
        year=2025,
        version="RB-TAX-2025.1",
        usn_rate_with_vat=Decimal("0.03"),
        usn_rate_without_vat=Decimal("0.05"),
        vat_rate=Decimal("0.20"),
        fsszn_employer=Decimal("0.34"),
        fsszn_employee=Decimal("0.01"),
    ),
    2026: TaxRules(
        year=2026,
        version="RB-TAX-2026.1",
        usn_rate_with_vat=Decimal("0.03"),
        usn_rate_without_vat=Decimal("0.05"),
        vat_rate=Decimal("0.20"),
        fsszn_employer=Decimal("0.34"),
        fsszn_employee=Decimal("0.01"),
    ),
}


@lru_cache(maxsize=1)
def _tax_rules_by_year() -> dict[int, TaxRules]:
    config_path = Path(__file__).resolve().parent.parent / "config" / "tax_rules.json"
    if not config_path.is_file():
        return _DEFAULT_TAX_RULES_BY_YEAR
    try:
        raw = json.loads(config_path.read_text(encoding="utf-8"))
        years = raw.get("years", {}) if isinstance(raw, dict) else {}
        loaded: dict[int, TaxRules] = {}
        for y, row in years.items():
            year = int(y)
            if not isinstance(row, dict):
                continue
            loaded[year] = TaxRules(
                year=year,
                version=str(row.get("version") or f"RB-TAX-{year}.1"),
                usn_rate_with_vat=Decimal(str(row.get("usn_rate_with_vat"))),
                usn_rate_without_vat=Decimal(str(row.get("usn_rate_without_vat"))),
                vat_rate=Decimal(str(row.get("vat_rate"))),
                fsszn_employer=Decimal(str(row.get("fsszn_employer"))),
                fsszn_employee=Decimal(str(row.get("fsszn_employee"))),
            )
        return loaded or _DEFAULT_TAX_RULES_BY_YEAR
    except Exception:
        return _DEFAULT_TAX_RULES_BY_YEAR


def validate_tax_rules_config() -> dict:
    config_path = Path(__file__).resolve().parent.parent / "config" / "tax_rules.json"
    payload = {
        "ok": True,
        "source": "default",
        "using_fallback": True,
        "path": str(config_path),
        "years": [],
        "warnings": [],
        "errors": [],
    }
    if not config_path.is_file():
        payload["warnings"].append("Конфиг не найден, используются встроенные правила.")
        payload["years"] = sorted(_DEFAULT_TAX_RULES_BY_YEAR.keys())
        return payload
    try:
        raw = json.loads(config_path.read_text(encoding="utf-8"))
        years = raw.get("years", {}) if isinstance(raw, dict) else {}
        if not isinstance(years, dict) or not years:
            raise ValueError("В tax_rules.json отсутствует непустой объект years")
        parsed_years: list[int] = []
        for y, row in years.items():
            year = int(y)
            if not isinstance(row, dict):
                raise ValueError(f"Год {year}: запись должна быть объектом")
            required = ("usn_rate_with_vat", "usn_rate_without_vat", "vat_rate", "fsszn_employer", "fsszn_employee")
            for key in required:
                if key not in row:
                    raise ValueError(f"Год {year}: отсутствует поле {key}")
                Decimal(str(row[key]))
            parsed_years.append(year)
        payload["source"] = "config"
        payload["using_fallback"] = False
        payload["years"] = sorted(parsed_years)
        return payload
    except Exception as exc:
        payload["ok"] = False
        payload["using_fallback"] = True
        payload["errors"].append(str(exc))
        payload["warnings"].append("При ошибке будет использован встроенный fallback.")
        payload["years"] = sorted(_DEFAULT_TAX_RULES_BY_YEAR.keys())
        return payload


def get_tax_rules_for_year(year: int) -> TaxRules:
    rules_by_year = _tax_rules_by_year()
    if year in rules_by_year:
        return rules_by_year[year]
    # Fallback to nearest known year to avoid hard failures.
    keys = sorted(rules_by_year.keys())
    nearest = max(k for k in keys if k <= year) if any(k <= year for k in keys) else min(keys)
    return rules_by_year[nearest]


@dataclass
class TaxResult:
    period_start: date
    period_end: date
    tax_regime: str

    # База
    income: Decimal = Decimal("0")
    expense: Decimal = Decimal("0")
    tax_base: Decimal = Decimal("0")

    # УСН
    usn_rate: Decimal = Decimal("0")
    usn_amount: Decimal = Decimal("0")
    usn_paid: Decimal = Decimal("0")
    usn_to_pay: Decimal = Decimal("0")

    # НДС
    vat_sales: Decimal = Decimal("0")
    vat_purchases: Decimal = Decimal("0")
    vat_to_pay: Decimal = Decimal("0")

    # ФСЗН
    fsszn_fot: Decimal = Decimal("0")
    fsszn_employer_rate: Decimal = FSSZN_EMPLOYER
    fsszn_employer_amount: Decimal = Decimal("0")
    fsszn_employee_amount: Decimal = Decimal("0")

    # Итого к уплате
    total_to_pay: Decimal = Decimal("0")
    deadline: date = date.today()


def _round(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def _quarter_deadline(year: int, quarter: int) -> date:
    """Срок уплаты УСН: 25-е числа месяца, следующего за кварталом."""
    month = quarter * 3 + 1
    if month > 12:
        month -= 12
        year += 1
    return date(year, month, 25)


def _month_deadline(year: int, month: int, day: int = 20) -> date:
    """Срок уплаты НДС: 20-е числа следующего месяца."""
    month += 1
    if month > 12:
        month = 1
        year += 1
    return date(year, month, day)


def calculate_usn(
    income: Decimal,
    period_start: date,
    period_end: date,
    with_vat: bool = False,
    paid_before: Decimal = Decimal("0"),
    usn_rate_with_vat: Decimal = USN_RATE_WITH_VAT,
    usn_rate_without_vat: Decimal = USN_RATE_WITHOUT_VAT,
) -> TaxResult:
    """
    Расчёт упрощённого налога (УСН).
    with_vat=True → ставка 3%, иначе 5%.
    """
    rate = usn_rate_with_vat if with_vat else usn_rate_without_vat
    tax_base = income
    usn_amount = _round(tax_base * rate)
    usn_to_pay = max(usn_amount - paid_before, Decimal("0"))

    # Определяем квартал из даты окончания периода
    quarter = (period_end.month - 1) // 3 + 1
    deadline = _quarter_deadline(period_end.year, quarter)

    result = TaxResult(
        period_start=period_start,
        period_end=period_end,
        tax_regime="usn_3" if with_vat else "usn_5",
        income=income,
        tax_base=tax_base,
        usn_rate=rate * 100,
        usn_amount=usn_amount,
        usn_paid=paid_before,
        usn_to_pay=usn_to_pay,
        deadline=deadline,
    )
    result.total_to_pay = usn_to_pay
    return result


def calculate_vat(
    sales_with_vat: Decimal,
    purchases_with_vat: Decimal,
    period_end: date,
    vat_rate: Decimal = VAT_RATE,
) -> tuple[Decimal, Decimal, Decimal, date]:
    """
    Расчёт НДС к уплате.
    Возвращает: (НДС с продаж, НДС с покупок, К уплате, дедлайн)
    """
    vat_sales = _round(sales_with_vat * vat_rate / (1 + vat_rate))
    vat_purchases = _round(purchases_with_vat * vat_rate / (1 + vat_rate))
    vat_to_pay = max(vat_sales - vat_purchases, Decimal("0"))
    deadline = _month_deadline(period_end.year, period_end.month, day=20)
    return vat_sales, vat_purchases, vat_to_pay, deadline


def calculate_fsszn(
    fot: Decimal,
    period_end: date,
    fsszn_employer_rate: Decimal = FSSZN_EMPLOYER,
    fsszn_employee_rate: Decimal = FSSZN_EMPLOYEE,
) -> tuple[Decimal, Decimal, date]:
    """
    Расчёт ФСЗН.
    Возвращает: (взнос нанимателя 34%, удержание с работника 1%, дедлайн)
    """
    employer = _round(fot * fsszn_employer_rate)
    employee = _round(fot * fsszn_employee_rate)
    # Срок: 15-е числа месяца, следующего за кварталом
    quarter = (period_end.month - 1) // 3 + 1
    deadline = _quarter_deadline(period_end.year, quarter)
    deadline = date(deadline.year, deadline.month, min(15, 28))
    return employer, employee, deadline


def calculate_salary(
    base_salary: Decimal,
    bonus: Decimal,
    sick_days: int,
    vacation_days: int,
    work_days_plan: int,
    has_children: int,
    is_disabled: bool,
) -> dict:
    """
    Расчёт зарплаты сотрудника за месяц (Беларусь).

    Формула:
      Начислено = (Оклад / рабочих дней) × отработанных дней + Премия
      НДФЛ = (Начислено − Вычеты) × 13%
      ФСЗН_работник = Начислено × 1%
      К выдаче = Начислено − НДФЛ − ФСЗН_работник
      ФСЗН_наниматель = Начислено × 34%
    """
    work_days_fact = work_days_plan - sick_days - vacation_days
    work_days_fact = max(work_days_fact, 0)

    # Пропорциональный оклад
    if work_days_plan > 0:
        daily_rate = base_salary / work_days_plan
        earned_salary = _round(daily_rate * work_days_fact)
    else:
        earned_salary = Decimal("0")

    # Больничные (80% среднего заработка — упрощённо)
    sick_pay = _round(base_salary / work_days_plan * sick_days * Decimal("0.8")) if work_days_plan > 0 else Decimal("0")

    # Отпускные (средний заработок × дни)
    vacation_pay = _round(base_salary / work_days_plan * vacation_days) if work_days_plan > 0 else Decimal("0")

    gross = _round(earned_salary + bonus + sick_pay + vacation_pay)

    # Налоговые вычеты (НДФЛ) — на детей
    deductions = Decimal("0")
    if has_children >= 1:
        deductions += CHILD_DEDUCTION_1_2
    if has_children >= 2:
        deductions += CHILD_DEDUCTION_1_2
    if has_children >= 3:
        deductions += CHILD_DEDUCTION_3_PLUS * max(has_children - 2, 0)

    taxable_income = max(gross - deductions, Decimal("0"))
    income_tax = _round(taxable_income * INCOME_TAX_RATE)
    fsszn_emp = _round(gross * FSSZN_EMPLOYEE)
    net = max(gross - income_tax - fsszn_emp, Decimal("0"))
    fsszn_employer = _round(gross * FSSZN_EMPLOYER)

    return {
        "base_salary": base_salary,
        "bonus": bonus,
        "sick_pay": sick_pay,
        "vacation_pay": vacation_pay,
        "work_days_plan": work_days_plan,
        "work_days_fact": work_days_fact,
        "sick_days": sick_days,
        "vacation_days": vacation_days,
        "gross_salary": gross,
        "income_tax": income_tax,
        "fsszn_employee": fsszn_emp,
        "net_salary": net,
        "fsszn_employer": fsszn_employer,
    }


def generate_tax_calendar(
    year: int,
    month_start: int = 1,
    tax_regime: str = "usn_no_vat",
    legal_form: str = "ip",
) -> list[dict]:
    """
    Генерирует список налоговых дат на год вперёд,
    учитывая режим налогообложения и форму организации.
    """
    has_vat = tax_regime in ("usn_vat", "osn_vat")
    has_usn = tax_regime.startswith("usn")
    is_ooo = legal_form == "ooo"

    events = []
    for month in range(month_start, month_start + 12):
        m = ((month - 1) % 12) + 1
        y = year + (month - 1) // 12

        if has_vat:
            events.append({
                "title": "Сдача декларации по НДС",
                "event_date": date(y, m, 20).isoformat(),
                "event_type": "tax",
                "color": "#DC2626",
                "is_auto": True,
            })

        if is_ooo:
            events.append({
                "title": "Выплата зарплаты",
                "event_date": date(y, m, 15).isoformat(),
                "event_type": "salary",
                "color": "#059669",
                "is_auto": True,
            })

        if m in (4, 7, 10, 1):
            if has_usn:
                events.append({
                    "title": "Уплата УСН за квартал",
                    "event_date": date(y, m, 25).isoformat(),
                    "event_type": "deadline",
                    "color": "#D97706",
                    "is_auto": True,
                })

            if is_ooo:
                events.append({
                    "title": "Уплата ФСЗН за квартал",
                    "event_date": date(y, m, 15).isoformat(),
                    "event_type": "report",
                    "color": "#7C3AED",
                    "is_auto": True,
                })

            events.append({
                "title": "Взносы ИП в ФСЗН" if not is_ooo else "Отчёт по ФСЗН",
                "event_date": date(y, m, min(15, 28)).isoformat(),
                "event_type": "report",
                "color": "#7C3AED",
                "is_auto": True,
            })

        if not has_usn and m in (4, 7, 10, 1):
            events.append({
                "title": "Авансовый платёж налога на прибыль",
                "event_date": date(y, m, 22).isoformat(),
                "event_type": "deadline",
                "color": "#D97706",
                "is_auto": True,
            })

    return events
