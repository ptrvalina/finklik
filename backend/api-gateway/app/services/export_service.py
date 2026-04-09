"""
Экспорт отчётов в Excel и PDF.
Excel: встроенный csv модуль (без внешних зависимостей для MVP)
PDF: текстовый формат (ReportLab опционально)
"""
import csv
import io
from decimal import Decimal
from datetime import date, datetime, timezone


def export_transactions_csv(transactions: list[dict]) -> bytes:
    """
    Экспорт транзакций в CSV (открывается в Excel).
    """
    output = io.StringIO()
    # BOM для корректного открытия в Excel с кириллицей
    output.write("\ufeff")

    writer = csv.DictWriter(
        output,
        fieldnames=["Дата", "Тип", "Сумма (BYN)", "НДС (BYN)", "Категория", "Описание", "Статус"],
        delimiter=";",
    )
    writer.writeheader()

    for tx in transactions:
        writer.writerow({
            "Дата": tx.get("transaction_date", ""),
            "Тип": "Доход" if tx.get("type") == "income" else "Расход",
            "Сумма (BYN)": str(tx.get("amount", "0")).replace(".", ","),
            "НДС (BYN)": str(tx.get("vat_amount", "0")).replace(".", ","),
            "Категория": tx.get("category", "") or "",
            "Описание": tx.get("description", ""),
            "Статус": tx.get("status", ""),
        })

    return output.getvalue().encode("utf-8-sig")


def export_salary_csv(salary_records: list[dict], employees: dict) -> bytes:
    """
    Экспорт зарплатной ведомости в CSV.
    employees: {employee_id: full_name}
    """
    output = io.StringIO()
    output.write("\ufeff")

    writer = csv.DictWriter(
        output,
        fieldnames=[
            "ФИО", "Должность", "Оклад", "Премия",
            "Начислено", "НДФЛ", "ФСЗН (1%)", "К выдаче",
            "ФСЗН нанимателя (34%)", "Статус",
        ],
        delimiter=";",
    )
    writer.writeheader()

    for rec in salary_records:
        writer.writerow({
            "ФИО": employees.get(rec.get("employee_id"), "—"),
            "Должность": rec.get("position", ""),
            "Оклад": str(rec.get("base_salary", "0")).replace(".", ","),
            "Премия": str(rec.get("bonus", "0")).replace(".", ","),
            "Начислено": str(rec.get("gross_salary", "0")).replace(".", ","),
            "НДФЛ": str(rec.get("income_tax", "0")).replace(".", ","),
            "ФСЗН (1%)": str(rec.get("fsszn_employee", "0")).replace(".", ","),
            "К выдаче": str(rec.get("net_salary", "0")).replace(".", ","),
            "ФСЗН нанимателя (34%)": str(rec.get("fsszn_employer", "0")).replace(".", ","),
            "Статус": rec.get("status", ""),
        })

    return output.getvalue().encode("utf-8-sig")


def export_tax_report_txt(tax_data: dict, org_name: str, unp: str) -> bytes:
    """
    Текстовый отчёт о налогах (псевдо-PDF для MVP).
    В проде заменить на ReportLab для красивого PDF.
    """
    lines = [
        "=" * 60,
        f"НАЛОГОВЫЙ ОТЧЁТ",
        f"Организация: {org_name}",
        f"УНП: {unp}",
        f"Период: {tax_data.get('period_start')} — {tax_data.get('period_end')}",
        f"Сформирован: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}",
        "=" * 60,
        "",
        "ДОХОДЫ И РАСХОДЫ",
        f"  Выручка:           {tax_data.get('income', 0):>12.2f} BYN",
        f"  Расходы:           {tax_data.get('expense', 0):>12.2f} BYN",
        f"  Прибыль:           {float(tax_data.get('income', 0)) - float(tax_data.get('expense', 0)):>12.2f} BYN",
        "",
        "РАСЧЁТ УСН",
        f"  Налоговая база:    {tax_data.get('tax_base', 0):>12.2f} BYN",
        f"  Ставка:            {tax_data.get('usn_rate', 0):>11.0f}%",
        f"  Начислено:         {tax_data.get('usn_amount', 0):>12.2f} BYN",
        f"  Уплачено ранее:    {tax_data.get('usn_paid', 0):>12.2f} BYN",
        f"  К УПЛАТЕ:          {tax_data.get('usn_to_pay', 0):>12.2f} BYN",
        "",
        "РАСЧЁТ НДС",
        f"  НДС с продаж:      {tax_data.get('vat_sales', 0):>12.2f} BYN",
        f"  НДС с покупок:     {tax_data.get('vat_purchases', 0):>12.2f} BYN",
        f"  К УПЛАТЕ:          {tax_data.get('vat_to_pay', 0):>12.2f} BYN",
        "",
        "ФСЗН",
        f"  ФОТ:               {tax_data.get('fsszn_fot', 0):>12.2f} BYN",
        f"  Взнос нанимателя:  {tax_data.get('fsszn_employer_amount', 0):>12.2f} BYN",
        f"  Удержание (1%):    {tax_data.get('fsszn_employee_amount', 0):>12.2f} BYN",
        "",
        "=" * 60,
        f"  ИТОГО К УПЛАТЕ:    {tax_data.get('total_to_pay', 0):>12.2f} BYN",
        f"  Срок уплаты:       {tax_data.get('deadline', '')}",
        "=" * 60,
    ]
    return "\n".join(lines).encode("utf-8")


def export_vat_declaration_txt(
    org_name: str,
    unp: str,
    quarter: int,
    year: int,
    sales: Decimal,
    purchases: Decimal,
    vat_sales: Decimal,
    vat_purchases: Decimal,
    vat_to_pay: Decimal,
    deadline: date,
) -> bytes:
    """Декларация по НДС за квартал (текстовый формат)."""
    q_label = f"Q{quarter} {year}"
    lines = [
        "=" * 60,
        "ДЕКЛАРАЦИЯ ПО НАЛОГУ НА ДОБАВЛЕННУЮ СТОИМОСТЬ",
        f"Квартал: {q_label}",
        "=" * 60,
        f"Организация: {org_name}",
        f"УНП: {unp}",
        f"Сформировано: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}",
        "",
        "-" * 60,
        "РАЗДЕЛ I. НАЛОГОВАЯ БАЗА",
        f"  Оборот по реализации:   {float(sales):>12.2f} BYN",
        f"  Обороты по приобрет.:   {float(purchases):>12.2f} BYN",
        "",
        "РАЗДЕЛ II. СУММА НДС",
        f"  НДС по реализации:      {float(vat_sales):>12.2f} BYN",
        f"  НДС по приобретению:    {float(vat_purchases):>12.2f} BYN",
        f"  НДС к вычету:           {float(vat_purchases):>12.2f} BYN",
        "",
        "РАЗДЕЛ III. ИТОГО",
        f"  НДС к уплате:           {float(vat_to_pay):>12.2f} BYN",
        f"  Срок уплаты:            {deadline.isoformat()}",
        "",
        "=" * 60,
        "Подпись руководителя: ________________",
        "Дата: ___.___.______",
        "=" * 60,
    ]
    return "\n".join(lines).encode("utf-8")


def export_fsszn_pu3_txt(
    org_name: str,
    unp: str,
    quarter: int,
    year: int,
    employees_data: list[dict],
    total_fot: Decimal,
    total_employer: Decimal,
    total_employee: Decimal,
) -> bytes:
    """Отчёт ФСЗН форма ПУ-3 (текстовый формат)."""
    q_label = f"Q{quarter} {year}"
    lines = [
        "=" * 70,
        "ФОРМА ПУ-3 (персонифицированный учёт ФСЗН)",
        f"Квартал: {q_label}",
        "=" * 70,
        f"Наниматель: {org_name}",
        f"УНП: {unp}",
        f"Сформировано: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}",
        "",
        "-" * 70,
        f"{'№':<4} {'ФИО':<30} {'Начислено':>12} {'34% нан.':>12} {'1% раб.':>12}",
        "-" * 70,
    ]

    for i, emp in enumerate(employees_data, 1):
        lines.append(
            f"{i:<4} {emp['name']:<30} {emp['gross']:>12.2f} {emp['employer']:>12.2f} {emp['employee']:>12.2f}"
        )

    lines += [
        "-" * 70,
        f"{'ИТОГО':<34} {float(total_fot):>12.2f} {float(total_employer):>12.2f} {float(total_employee):>12.2f}",
        "=" * 70,
        "",
        "Руководитель: ________________",
        "Главный бухгалтер: ________________",
        f"Дата: ___.___.{year}",
        "=" * 70,
    ]
    return "\n".join(lines).encode("utf-8")


def export_analytics_csv(
    period: str,
    income_by_month: list[dict],
    expense_by_month: list[dict],
) -> bytes:
    """Экспорт аналитики доходов/расходов по месяцам."""
    output = io.StringIO()
    output.write("\ufeff")

    writer = csv.DictWriter(
        output,
        fieldnames=["Период", "Доходы (BYN)", "Расходы (BYN)", "Прибыль (BYN)", "Рентабельность (%)"],
        delimiter=";",
    )
    writer.writeheader()

    income_map = {r["month"]: r["total"] for r in income_by_month}
    expense_map = {r["month"]: r["total"] for r in expense_by_month}
    all_months = sorted(set(list(income_map.keys()) + list(expense_map.keys())))

    for month in all_months:
        inc = float(income_map.get(month, 0))
        exp = float(expense_map.get(month, 0))
        profit = inc - exp
        margin = round(profit / inc * 100, 1) if inc > 0 else 0

        writer.writerow({
            "Период": month,
            "Доходы (BYN)": f"{inc:.2f}".replace(".", ","),
            "Расходы (BYN)": f"{exp:.2f}".replace(".", ","),
            "Прибыль (BYN)": f"{profit:.2f}".replace(".", ","),
            "Рентабельность (%)": f"{margin}".replace(".", ","),
        })

    return output.getvalue().encode("utf-8-sig")
