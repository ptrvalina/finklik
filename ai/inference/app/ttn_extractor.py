"""
Улучшенный экстрактор для ТТН-1 (товарно-транспортная накладная).

Проблема пилота: точность 76% на ТТН-1 из-за таблиц с >10 строками.
Решение: специализированный парсер таблиц + усиленные регулярки для ТТН-1.
Цель: >90% точность.
"""
import re
from dataclasses import dataclass, field


@dataclass
class TTNTableRow:
    number: str = ""
    name: str = ""
    unit: str = ""
    quantity: float = 0.0
    price: float = 0.0
    amount: float = 0.0
    vat_rate: float = 0.0
    vat_amount: float = 0.0


@dataclass
class TTNData:
    # Реквизиты
    doc_number: str = ""
    doc_date: str = ""
    unp_sender: str = ""
    unp_receiver: str = ""
    sender_name: str = ""
    receiver_name: str = ""
    driver_name: str = ""
    vehicle_number: str = ""
    route_from: str = ""
    route_to: str = ""

    # Таблица товаров
    items: list[TTNTableRow] = field(default_factory=list)

    # Итоги
    total_amount: float = 0.0
    total_vat: float = 0.0
    total_amount_text: str = ""  # Сумма прописью

    # Мета
    confidence: float = 0.0
    warnings: list[str] = field(default_factory=list)


# ── Регулярки для ТТН-1 ──────────────────────────────────────────────────────

# Дефис в «ТОВАРНО-ТРАНСПОРТНАЯ» в OCR может быть ASCII или Unicode (– — −).
_HY = r"[\-\u2010\u2011\u2012\u2013\u2014\u2212]"
# Сначала «№ ТТН-…» — самый устойчивый якорь; затем полная шапка; короткие формы — в конце.
# У короткой формы без «№» легко поймать ложное вхождение «ттн» в тексте — «№» делаем предпочтительным.
RE_TTN_NUMBER = re.compile(
    r"(?:"
    r"[№#]\s*(ТТН[-\sA-ZА-ЯЁё0-9\/\.]{2,24})"
    r"|"
    r"товарно" + _HY + r"\s*транспортная\s+накладная\s*[№#]\s*([А-ЯA-Z0-9\-\/]{3,24})"
    r"|"
    r"(?:тн-?2|ттн)\s*[№#]\s*([А-ЯA-Z0-9\-\/]{3,24})"
    r"|"
    r"(?:тн-?2|ттн)\s*([А-ЯA-Z0-9\-\/]{3,24})"
    r")",
    re.IGNORECASE,
)

# Если основная регулярка дала мусор (старые OCR / странный порядок полей).
RE_TTN_FALLBACK = re.compile(
    r"[№#]\s*(ТТН[-\sA-ZА-ЯЁё0-9\/\.]{2,24})",
    re.IGNORECASE,
)

RE_UNP_LABELED = re.compile(
    r'(?:унп|уn)[:\s]*(\d{9})',
    re.IGNORECASE,
)

RE_SENDER = re.compile(
    r'(?:грузоотправитель|отправитель)[:\s]+([^\n]{5,80})',
    re.IGNORECASE,
)

RE_RECEIVER = re.compile(
    r'(?:грузополучатель|получатель)[:\s]+([^\n]{5,80})',
    re.IGNORECASE,
)

RE_DRIVER = re.compile(
    r'(?:водитель|ф\.и\.о\.[:\s]*водителя)[:\s]+([А-Я][а-я]+\s+[А-Я][а-я]+(?:\s+[А-Я][а-я]+)?)',
    re.IGNORECASE,
)

RE_VEHICLE = re.compile(
    r'(?:гос\.?\s*номер|регистрационный\s+номер|номер\s+авто)[:\s]*([А-ЯA-Z0-9\-]{4,10})',
    re.IGNORECASE,
)

RE_TOTAL = re.compile(
    r'(?:итого|всего)[:\s]*([\d\s]+[,.][\d]{2})',
    re.IGNORECASE,
)

RE_TOTAL_VAT = re.compile(
    r'(?:ндс|нДС\s+итого)[:\s]*([\d\s]+[,.][\d]{2})',
    re.IGNORECASE,
)

RE_AMOUNT_TEXT = re.compile(
    r'(?:сумма\s+прописью|итого\s+прописью)[:\s]+([А-Яа-я\s]+(?:рублей?|рублей?\s+\d+\s+коп\w*)?)',
    re.IGNORECASE,
)

# Строка таблицы: номер | наименование | ед.изм | кол-во | цена | сумма
RE_TABLE_ROW = re.compile(
    r'^\s*(\d{1,3})\s+'                    # номер п/п
    r'(.{3,50}?)\s+'                        # наименование
    r'(шт|кг|л|м|компл|уп|пар|упак)\s+'   # единица измерения
    r'([\d]+(?:[.,]\d+)?)\s+'              # количество
    r'([\d\s]+[.,][\d]{2})\s+'            # цена
    r'([\d\s]+[.,][\d]{2})',               # сумма
    re.IGNORECASE | re.MULTILINE,
)


def _parse_number(s: str) -> float:
    try:
        return float(re.sub(r'[\s\xa0]', '', s).replace(',', '.'))
    except (ValueError, TypeError):
        return 0.0


def validate_unp(unp: str) -> bool:
    """
    Проверка контрольной суммы УНП Беларуси.
    Алгоритм: weighted sum mod 11.
    """
    if not unp or not re.fullmatch(r'\d{9}', unp):
        return False
    weights = [29, 23, 19, 17, 13, 7, 5, 3]
    total = sum(int(unp[i]) * weights[i] for i in range(8))
    check = total % 11
    if check == 10:
        # Пересчёт с другими весами
        weights2 = [23, 19, 17, 13, 7, 5, 3, 29]
        total2 = sum(int(unp[i]) * weights2[i] for i in range(8))
        check = total2 % 11
    return check == int(unp[8])


def _is_plausible_doc_number(s: str) -> bool:
    if not s or s.casefold() == "накладная":
        return False
    cf = s.casefold()
    return "ттн" in cf or any(c.isdigit() for c in s)


def validate_table_totals(items: list[TTNTableRow], declared_total: float) -> tuple[bool, float]:
    """Проверяем что сумма по позициям сходится с итогом."""
    calc_total = sum(item.amount for item in items)
    diff = abs(calc_total - declared_total)
    return diff < 0.02, calc_total  # допуск 2 копейки


def extract_ttn_data(ocr_text: str) -> TTNData:
    """
    Извлекает структурированные данные из ТТН-1.
    Специализированная функция с таблицами и валидацией.
    """
    result = TTNData()
    text = ocr_text
    fields_found = 0

    # ── Номер ТТН ─────────────────────────────────────────────────────
    m = RE_TTN_NUMBER.search(text)
    if m:
        result.doc_number = (
            (m.group(1) or m.group(2) or m.group(3) or m.group(4) or "").strip()
        )
        result.doc_number = re.sub(r"\s+", "", result.doc_number)

    if not _is_plausible_doc_number(result.doc_number):
        m2 = RE_TTN_FALLBACK.search(text)
        if m2:
            result.doc_number = re.sub(r"\s+", "", m2.group(1).strip())

    if _is_plausible_doc_number(result.doc_number):
        fields_found += 1

    # ── УНП (берём первые два вхождения) ──────────────────────────────
    unps = RE_UNP_LABELED.findall(text)
    valid_unps = [u for u in unps if validate_unp(u)]
    invalid_unps = [u for u in unps if not validate_unp(u)]

    if valid_unps:
        result.unp_sender = valid_unps[0]
        if len(valid_unps) > 1:
            result.unp_receiver = valid_unps[1]
        fields_found += 1
    if invalid_unps:
        result.warnings.append(f"УНП не прошли контрольную сумму: {invalid_unps}")

    # ── Грузоотправитель / получатель ─────────────────────────────────
    m = RE_SENDER.search(text)
    if m:
        result.sender_name = m.group(1).strip()[:80]
        fields_found += 1

    m = RE_RECEIVER.search(text)
    if m:
        result.receiver_name = m.group(1).strip()[:80]
        fields_found += 1

    # ── Водитель и транспорт ──────────────────────────────────────────
    m = RE_DRIVER.search(text)
    if m:
        result.driver_name = m.group(1).strip()

    m = RE_VEHICLE.search(text)
    if m:
        result.vehicle_number = m.group(1).strip()

    # ── Таблица товаров ───────────────────────────────────────────────
    rows = RE_TABLE_ROW.findall(text)
    for row in rows:
        item = TTNTableRow(
            number=row[0],
            name=row[1].strip(),
            unit=row[2],
            quantity=_parse_number(row[3]),
            price=_parse_number(row[4]),
            amount=_parse_number(row[5]),
        )
        # Пересчёт суммы для валидации
        if item.price > 0 and item.quantity > 0:
            expected = round(item.price * item.quantity, 2)
            if abs(expected - item.amount) > 0.02:
                result.warnings.append(
                    f"Строка {item.number}: цена×кол-во ({expected}) ≠ сумма ({item.amount})"
                )
        result.items.append(item)

    if result.items:
        fields_found += 1

    # ── Итоги ─────────────────────────────────────────────────────────
    m = RE_TOTAL.search(text)
    if m:
        result.total_amount = _parse_number(m.group(1))
        fields_found += 1

    m = RE_TOTAL_VAT.search(text)
    if m:
        result.total_vat = _parse_number(m.group(1))

    m = RE_AMOUNT_TEXT.search(text)
    if m:
        result.total_amount_text = m.group(1).strip()

    # ── Валидация итогов ──────────────────────────────────────────────
    if result.items and result.total_amount > 0:
        ok, calc = validate_table_totals(result.items, result.total_amount)
        if not ok:
            result.warnings.append(
                f"Сумма по позициям ({calc:.2f}) не совпадает с итогом ({result.total_amount:.2f})"
            )

    # ── Уверенность ───────────────────────────────────────────────────
    # Максимум 6 полей: номер, унп, отправитель, получатель, таблица, итого
    result.confidence = round(min(fields_found / 5.0, 1.0), 2)

    if not result.doc_number:
        result.warnings.append("Номер ТТН не распознан")
    if not result.items:
        result.warnings.append("Таблица товаров не распознана — возможно плохое качество фото")
    if not result.unp_sender:
        result.warnings.append("УНП отправителя не найден")

    return result
