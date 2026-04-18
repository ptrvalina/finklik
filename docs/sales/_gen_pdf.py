"""Generate bank white-label pitch PDF (ReportLab).

Run from repository root::

    pip install reportlab
    python docs/sales/_gen_pdf.py

Writes ``docs/sales/ФинКлик_WhiteLabel_Банки.pdf``. Uses Windows fonts when available;
falls back to Helvetica.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, Color
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import Paragraph, Frame
from reportlab.lib.styles import ParagraphStyle

W, H = A4
OUT = os.path.join(os.path.dirname(__file__), "ФинКлик_WhiteLabel_Банки.pdf")

BG       = HexColor("#070a10")
SURFACE  = HexColor("#0f1420")
SURFACE2 = HexColor("#161c2c")
BORDER   = HexColor("#1e2740")
ACCENT   = HexColor("#4f8cff")
ACCENT2  = HexColor("#6c5ce7")
GREEN    = HexColor("#00d68f")
ORANGE   = HexColor("#ffaa00")
RED      = HexColor("#ff4d6a")
TEXT     = HexColor("#e8ecf4")
MUTED    = HexColor("#8892a8")
WHITE    = HexColor("#ffffff")

def _register_fonts():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import glob
    win_fonts = r"C:\Windows\Fonts"
    candidates = [
        ("Arial", "arial.ttf", "arialbd.ttf"),
        ("Segoe UI", "segoeui.ttf", "segoeuib.ttf"),
        ("Calibri", "calibri.ttf", "calibrib.ttf"),
    ]
    for name, regular, bold in candidates:
        r = os.path.join(win_fonts, regular)
        b = os.path.join(win_fonts, bold)
        if os.path.exists(r):
            try:
                pdfmetrics.registerFont(TTFont(name, r))
                if os.path.exists(b):
                    pdfmetrics.registerFont(TTFont(f"{name}-Bold", b))
                else:
                    pdfmetrics.registerFont(TTFont(f"{name}-Bold", r))
                return name
            except Exception:
                continue
    return "Helvetica"

FONT = _register_fonts()
FONT_B = f"{FONT}-Bold"

def draw_bg(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)

def draw_rounded_rect(c, x, y, w, h, r=8, fill=None, stroke=None, lw=0.5):
    c.saveState()
    if fill:
        c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(lw)
    c.roundRect(x, y, w, h, r, fill=1 if fill else 0, stroke=1 if stroke else 0)
    c.restoreState()

def draw_text(c, x, y, text, size=10, color=TEXT, font=None, align="left"):
    c.saveState()
    c.setFillColor(color)
    c.setFont(font or FONT, size)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)
    c.restoreState()

def draw_check(c, x, y, color=GREEN):
    draw_text(c, x, y, "✓", 11, color, FONT_B)

def new_page(c):
    c.showPage()
    draw_bg(c)

# --------------- SLIDES ---------------

def slide_hero(c):
    draw_bg(c)
    cy = H / 2
    draw_text(c, W/2, cy + 100, "WHITE LABEL РЕШЕНИЕ", 11, ACCENT, FONT_B, "center")

    c.saveState()
    c.setFont(FONT_B, 38)
    c.setFillColor(ACCENT)
    c.drawCentredString(W/2, cy + 50, "ФинКлик")
    c.restoreState()

    style = ParagraphStyle("sub", fontName=FONT, fontSize=13, textColor=MUTED,
                           alignment=TA_CENTER, leading=18)
    p = Paragraph("Готовая цифровая платформа бухгалтерского учёта<br/>для МСБ-клиентов вашего банка", style)
    pw, ph = p.wrap(400, 100)
    p.drawOn(c, (W - pw) / 2, cy + 5)

    nums = [("4–8", "недель до запуска"), ("40K+", "клиентов"), ("×2.5", "рост ARPU")]
    sx = W/2 - 180
    for i, (val, label) in enumerate(nums):
        nx = sx + i * 180
        draw_text(c, nx, cy - 70, val, 28, ACCENT, FONT_B, "center")
        draw_text(c, nx, cy - 90, label, 9, MUTED, FONT, "center")

    draw_text(c, W/2, 40, "© 2026 ФинКлик  ·  Конфиденциально", 7, MUTED, FONT, "center")

def slide_problem(c):
    new_page(c)
    draw_text(c, 40, H - 60, "Проблема", 24, ACCENT, FONT_B)
    draw_text(c, 40, H - 85, "4 из 5 предпринимателей в Беларуси ведут учёт в Excel или на бумаге", 10, MUTED)

    rows = [
        ("Нет автоматизации учёта", "Клиент уходит к конкурентам с экосистемой"),
        ("Ошибки в отчётности → штрафы", "Закрытие бизнеса = потеря клиента"),
        ("Нет интеграции «банк ↔ учёт»", "Низкая вовлечённость в ДБО"),
        ("Дорогой бухгалтер", "Клиент не растёт → меньше оборотов по счёту"),
    ]

    col_w = (W - 80) / 2
    y0 = H - 130
    rh = 55

    draw_rounded_rect(c, 40, y0 - len(rows)*rh - rh, W - 80, (len(rows)+1)*rh, 10, fill=SURFACE2, stroke=BORDER)

    draw_text(c, 55, y0 - 15, "БОЛЬ КЛИЕНТА БАНКА", 8, MUTED, FONT_B)
    draw_text(c, 55 + col_w, y0 - 15, "ПОСЛЕДСТВИЯ ДЛЯ БАНКА", 8, MUTED, FONT_B)
    c.setStrokeColor(BORDER); c.setLineWidth(0.5)
    c.line(40, y0 - rh + 20, W - 40, y0 - rh + 20)

    for i, (left, right) in enumerate(rows):
        ry = y0 - (i + 1) * rh - 15
        draw_text(c, 55, ry + 15, left, 10, TEXT, FONT_B)
        draw_text(c, 55 + col_w, ry + 15, right, 10, MUTED)
        if i < len(rows) - 1:
            c.line(40, ry - 5, W - 40, ry - 5)

    draw_rounded_rect(c, 40, y0 - len(rows)*rh - rh - 100, W - 80, 70, 10, fill=SURFACE, stroke=ACCENT)
    draw_text(c, W/2, y0 - len(rows)*rh - rh - 55, "Банки с экосистемой удерживают на 40% больше МСБ-клиентов", 12, TEXT, FONT_B, "center")
    draw_text(c, W/2, y0 - len(rows)*rh - rh - 75, "и увеличивают ARPU в 2-3 раза", 11, ACCENT, FONT_B, "center")

def _draw_module_card(c, x, y, w, h, icon, title, items, icon_color=ACCENT):
    draw_rounded_rect(c, x, y, w, h, 10, fill=SURFACE2, stroke=BORDER)
    draw_text(c, x + 15, y + h - 25, icon, 16, icon_color, FONT)
    draw_text(c, x + 15, y + h - 45, title, 11, TEXT, FONT_B)
    for j, item in enumerate(items):
        draw_text(c, x + 25, y + h - 65 - j * 16, "→ " + item, 8, MUTED)

def slide_solution(c):
    new_page(c)
    draw_text(c, 40, H - 60, "Решение: ФинКлик White Label", 22, ACCENT, FONT_B)
    draw_text(c, 40, H - 82, "Готовый продукт под вашим брендом — вместо 12-18 месяцев разработки с нуля", 9, MUTED)

    modules = [
        ("📊", "Финансовый учёт", ["Доходы, расходы, возвраты", "10 категорий расходов", "Импорт CSV / выписок", "Экспорт PDF, CSV, TXT"], ACCENT),
        ("🏦", "Интеграция с банком", ["Автозагрузка выписок API", "Баланс в реальном времени", "Платежи из учёта", "Мульти-банк"], GREEN),
        ("📋", "Налоги и отчётность", ["УСН 6%, НДС 10/20/25%, ФСЗН", "НДС, ПУ-3 из учёта", "Дедлайны и напоминания", "Подтверждение и выгрузки"], ORANGE),
        ("🤖", "AI-модуль", ["OCR чеков, ТТН, актов", "Извлечение реквизитов", "ИИ-консультант", "Точность ТТН >90%"], HexColor("#6c5ce7")),
        ("👥", "Кадры и зарплата", ["Реестр сотрудников", "Расчёт зарплаты", "Шифрование ПДн AES-256", "Зарплатные ведомости"], RED),
        ("📡", "Мониторинг законов", ["ИМНС, ФСЗН, Белгосстрах", "Новые формы и ставки", "Push-уведомления", "Фильтрация"], ACCENT),
    ]

    cw = (W - 100) / 3
    ch = 140
    gap = 10
    y0 = H - 120

    for i, (icon, title, items, color) in enumerate(modules):
        col = i % 3
        row = i // 3
        x = 40 + col * (cw + gap)
        y = y0 - (row + 1) * (ch + gap)
        _draw_module_card(c, x, y, cw, ch, icon, title, items, color)

def slide_security(c):
    new_page(c)
    draw_text(c, 40, H - 60, "Безопасность", 24, ACCENT, FONT_B)
    draw_text(c, 40, H - 82, "Соответствие требованиям регулятора — из коробки", 10, MUTED)

    items = [
        ("Шифрование ПДн", "AES-256 (Fernet), данные зашифрованы at rest"),
        ("Аутентификация", "JWT с refresh-токенами, 15 мин. access-токен"),
        ("Brute-force защита", "Блокировка после 5 неудач на 15 минут"),
        ("Rate limiting", "120 req/min на пользователя, burst до 30"),
        ("Security headers", "CSP, X-Frame-Options DENY, HSTS, XSS"),
        ("Аудит-лог", "Все действия: кто, что, когда, IP"),
        ("Мульти-тенантность", "Изоляция данных по organization_id"),
        ("HTTPS / TLS 1.2+", "Обязательно для production"),
    ]

    cw = (W - 90) / 2
    ch = 50
    gap = 8
    y0 = H - 110

    for i, (title, desc) in enumerate(items):
        col = i % 2
        row = i // 2
        x = 40 + col * (cw + gap)
        y = y0 - (row + 1) * (ch + gap)
        draw_rounded_rect(c, x, y, cw, ch, 8, fill=SURFACE2, stroke=BORDER)
        draw_check(c, x + 12, y + ch - 22)
        draw_text(c, x + 28, y + ch - 20, title, 10, TEXT, FONT_B)
        draw_text(c, x + 28, y + ch - 37, desc, 7.5, MUTED)

def slide_tech(c):
    new_page(c)
    draw_text(c, 40, H - 60, "Технологии", 24, ACCENT, FONT_B)
    draw_text(c, 40, H - 82, "Современный стек, готовый к масштабированию", 10, MUTED)

    headers = ["Слой", "Технологии", "Для банка это значит"]
    rows = [
        ["Backend", "Python, FastAPI, PostgreSQL", "Стабильность, масштабируемость"],
        ["Frontend", "React, TypeScript, Tailwind", "Любой браузер, адаптивность, PWA"],
        ["Безопасность", "JWT, AES-256, CSP, rate-limit", "Соответствие требованиям регулятора"],
        ["Инфраструктура", "Docker, Prometheus, Grafana", "Мониторинг 24/7, быстрый деплой"],
        ["CI/CD", "GitHub Actions, автотесты", "Безошибочные обновления"],
        ["API", "REST, WebSocket, OpenAPI", "Интеграция с любой АБС банка"],
    ]

    tw = W - 80
    y0 = H - 120
    rh = 35
    col_ws = [tw * 0.2, tw * 0.4, tw * 0.4]

    draw_rounded_rect(c, 40, y0 - (len(rows)+1)*rh - 10, tw, (len(rows)+1)*rh + 10, 10, fill=SURFACE2, stroke=BORDER)

    cx = 55
    for j, h in enumerate(headers):
        draw_text(c, cx, y0 - 18, h, 8, MUTED, FONT_B)
        cx += col_ws[j]
    c.setStrokeColor(BORDER); c.setLineWidth(0.5)
    c.line(40, y0 - rh + 10, W - 40, y0 - rh + 10)

    for i, row in enumerate(rows):
        ry = y0 - (i + 1) * rh - 18
        cx = 55
        for j, cell in enumerate(row):
            f = FONT_B if j == 0 else FONT
            clr = ACCENT if j == 0 else TEXT if j == 1 else MUTED
            draw_text(c, cx, ry + 10, cell, 9, clr, f)
            cx += col_ws[j]
        if i < len(rows) - 1:
            c.line(50, ry - 2, W - 50, ry - 2)

    y_sc = y0 - (len(rows)+1)*rh - 50
    draw_text(c, 40, y_sc, "Масштабирование", 18, ACCENT, FONT_B)
    draw_text(c, 40, y_sc - 20, "Архитектура рассчитана на 40 000+ клиентов", 9, MUTED)

    scale_rows = [
        ["До 100", "1 VPS (4 CPU, 8 GB)", "~50 USD/мес"],
        ["100 – 500", "2-3 реплики + Managed PG", "~300 USD/мес"],
        ["500 – 5 000", "Kubernetes, HPA, replicas", "~800 USD/мес"],
        ["5 000 – 40 000", "K8s cluster, шардирование", "~2 500 USD/мес"],
    ]

    sh = 30
    sy = y_sc - 50
    draw_rounded_rect(c, 40, sy - len(scale_rows)*sh - 10, tw, len(scale_rows)*sh + 40, 10, fill=SURFACE2, stroke=BORDER)
    s_cols = [tw * 0.25, tw * 0.45, tw * 0.3]
    s_hdrs = ["Клиенты", "Инфраструктура", "Стоимость"]
    cx = 55
    for j, h in enumerate(s_hdrs):
        draw_text(c, cx, sy + 10, h, 8, MUTED, FONT_B)
        cx += s_cols[j]
    c.line(40, sy - 2, W - 40, sy - 2)

    for i, row in enumerate(scale_rows):
        ry = sy - (i + 1) * sh
        cx = 55
        for j, cell in enumerate(row):
            clr = ACCENT if j == 2 else TEXT
            draw_text(c, cx, ry + 8, cell, 9, clr, FONT_B if j == 2 else FONT)
            cx += s_cols[j]

def slide_whitelabel(c):
    new_page(c)
    draw_text(c, 40, H - 60, "Что входит в White Label", 22, ACCENT, FONT_B)
    draw_text(c, 40, H - 82, "Полная кастомизация + интеграция + поддержка", 10, MUTED)

    blocks = [
        ("🎨", "Бренд банка", ["Логотип, цвета, шрифты", "Домен: business.yourbank.by", "Email от имени банка", "Дисклеймеры и соглашения", "Favicon и PWA-иконки"], ACCENT),
        ("🔗", "Интеграция с АБС", ["API загрузки выписок", "Webhook-уведомления", "SSO через систему банка", "Обмен по контрагентам", "Интеграция с 1С"], GREEN),
        ("🛠", "Поддержка", ["SLA на отклик/устранение", "Ежемесячные обновления", "Новые формы, ставки, законы", "Выделенный канал", "Обучение сотрудников"], ORANGE),
    ]

    cw = (W - 100) / 3
    ch = 165
    y0 = H - 110

    for i, (icon, title, items, color) in enumerate(blocks):
        x = 40 + i * (cw + 10)
        _draw_module_card(c, x, y0 - ch, cw, ch, icon, title, items, color)

def slide_pricing(c):
    new_page(c)
    draw_text(c, 40, H - 60, "Бизнес-модель", 24, ACCENT, FONT_B)
    draw_text(c, 40, H - 82, "Два варианта партнёрства", 10, MUTED)

    pw = (W - 90) / 2
    ph = 200
    y0 = H - 110

    # Variant A
    draw_rounded_rect(c, 40, y0 - ph, pw, ph, 12, fill=SURFACE2, stroke=BORDER)
    draw_text(c, 55, y0 - 25, "Вариант A: Лицензия", 12, TEXT, FONT_B)
    lines_a = [
        ("Лицензия (perpetual)", "25 000 – 50 000 USD"),
        ("Кастомизация", "5 000 – 10 000 USD"),
        ("Интеграция с АБС", "10 000 – 20 000 USD"),
        ("Поддержка/мес", "1 500 – 3 000 USD"),
    ]
    for i, (label, val) in enumerate(lines_a):
        ly = y0 - 60 - i * 35
        draw_text(c, 55, ly, label, 9, MUTED)
        draw_text(c, 40 + pw - 15, ly, val, 9, ACCENT, FONT_B, "right")
        if i < len(lines_a) - 1:
            c.setStrokeColor(BORDER); c.setLineWidth(0.3)
            c.line(55, ly - 12, 40 + pw - 15, ly - 12)

    # Variant B
    x2 = 50 + pw
    draw_rounded_rect(c, x2, y0 - ph, pw, ph, 12, fill=SURFACE2, stroke=ACCENT, lw=2)

    draw_rounded_rect(c, x2 + pw - 100, y0 - 5, 90, 18, 9, fill=ACCENT)
    draw_text(c, x2 + pw - 55, y0, "РЕКОМЕНДУЕМ", 7, WHITE, FONT_B, "center")

    draw_text(c, x2 + 15, y0 - 25, "Вариант B: SaaS (rev. share)", 12, TEXT, FONT_B)
    lines_b = [
        ("Развёртывание", "10 000 – 15 000 USD"),
        ("За клиента/мес", "2 – 5 USD"),
        ("Минимум/мес", "500 USD"),
        ("Масштабирование", "Линейное"),
    ]
    for i, (label, val) in enumerate(lines_b):
        ly = y0 - 60 - i * 35
        draw_text(c, x2 + 15, ly, label, 9, MUTED)
        draw_text(c, x2 + pw - 15, ly, val, 9, ACCENT, FONT_B, "right")
        if i < len(lines_b) - 1:
            c.setStrokeColor(BORDER); c.setLineWidth(0.3)
            c.line(x2 + 15, ly - 12, x2 + pw - 15, ly - 12)

    # ROI
    y_roi = y0 - ph - 40
    draw_text(c, 40, y_roi, "ROI для банка", 18, ACCENT, FONT_B)

    roi_items = [
        ("−50%", "Снижение churn МСБ"),
        ("×2.5", "Рост ARPU"),
        ("Магнит", "Привлечение клиентов"),
        ("Cross-sell", "Данные → зарплатный, кредит"),
    ]
    rw = (W - 100) / 4
    rh = 60
    for i, (val, label) in enumerate(roi_items):
        rx = 40 + i * (rw + 8)
        draw_rounded_rect(c, rx, y_roi - rh - 20, rw, rh, 10, fill=SURFACE2, stroke=BORDER)
        draw_text(c, rx + rw/2, y_roi - 35, val, 16, GREEN, FONT_B, "center")
        draw_text(c, rx + rw/2, y_roi - 55, label, 7, MUTED, FONT, "center")

def slide_comparison(c):
    new_page(c)
    draw_text(c, 40, H - 60, "Сравнение", 24, ACCENT, FONT_B)

    pw = (W - 90) / 2
    ph = 200
    y0 = H - 100

    # Left: build from scratch
    draw_rounded_rect(c, 40, y0 - ph, pw, ph, 12, fill=HexColor("#120a10"), stroke=RED, lw=1)
    draw_text(c, 55, y0 - 25, "Разработка с нуля", 13, RED, FONT_B)
    bad = [
        "12-18 месяцев до MVP",
        "200-500K USD на R&D",
        "Риск: сроки, баги, текучка команды",
        "Обновления законов — своими силами",
        "Отвлечение IT-ресурсов банка",
    ]
    for i, t in enumerate(bad):
        draw_text(c, 70, y0 - 60 - i * 25, "✕  " + t, 9.5, MUTED)

    # Right: FinKlik
    x2 = 50 + pw
    draw_rounded_rect(c, x2, y0 - ph, pw, ph, 12, fill=HexColor("#041210"), stroke=GREEN, lw=1)
    draw_text(c, x2 + 15, y0 - 25, "ФинКлик White Label", 13, GREEN, FONT_B)
    good = [
        "4-8 недель до запуска",
        "От 10K USD стартовые затраты",
        "Проверено на реальных клиентах",
        "Обновления законов — в комплекте",
        "Банк фокусируется на бизнесе",
    ]
    for i, t in enumerate(good):
        draw_text(c, x2 + 30, y0 - 60 - i * 25, "✓  " + t, 9.5, MUTED)

    # Roadmap
    y_road = y0 - ph - 50
    draw_text(c, 40, y_road, "Дорожная карта", 18, ACCENT, FONT_B)

    roadmap = [
        ("Q2 2026", "Учёт, налоги, AI-сканер, аналитика, мульти-тенант, CI/CD", GREEN),
        ("Q3 2026", "Мобильное приложение, Open Banking API, эквайринг", ACCENT),
        ("Q4 2026", "Кредитный скоринг, AI-прогнозы cash flow", ACCENT),
        ("Q1 2027", "Маркетплейс услуг, электронный документооборот", BORDER),
    ]

    for i, (q, desc, color) in enumerate(roadmap):
        ty = y_road - 35 - i * 40
        c.setFillColor(color)
        c.circle(55, ty + 4, 6, fill=1, stroke=0)
        if i < len(roadmap) - 1:
            c.setStrokeColor(BORDER); c.setLineWidth(1)
            c.line(55, ty - 2, 55, ty - 34)
        draw_text(c, 75, ty, q, 10, TEXT, FONT_B)
        draw_text(c, 135, ty, desc, 9, MUTED)

def slide_cta(c):
    new_page(c)
    cy = H / 2

    draw_text(c, W/2, cy + 80, "Готовы обсудить?", 28, ACCENT, FONT_B, "center")

    style = ParagraphStyle("cta", fontName=FONT, fontSize=11, textColor=MUTED,
                           alignment=TA_CENTER, leading=16)
    p = Paragraph("Запросите персональную демонстрацию<br/>и коммерческое предложение для вашего банка", style)
    pw, ph = p.wrap(400, 100)
    p.drawOn(c, (W - pw) / 2, cy + 25)

    bw, bh = 220, 44
    bx = (W - bw) / 2
    by = cy - 20
    draw_rounded_rect(c, bx, by, bw, bh, 12, fill=ACCENT)
    draw_text(c, W/2, by + 14, "Запросить демо  →", 13, WHITE, FONT_B, "center")

    draw_text(c, W/2, by - 30, "Демонстрация  ·  КП  ·  Пилотный проект", 9, MUTED, FONT, "center")

    draw_text(c, W/2, 60, "© 2026 ФинКлик  ·  Все права защищены", 8, MUTED, FONT, "center")
    draw_text(c, W/2, 45, "Документ конфиденциален", 8, MUTED, FONT, "center")


def main():
    c = Canvas(OUT, pagesize=A4)
    c.setTitle("ФинКлик — White Label для банков")
    c.setAuthor("ФинКлик")
    c.setSubject("Коммерческое предложение White Label")

    slide_hero(c)
    slide_problem(c)
    slide_solution(c)
    slide_security(c)
    slide_tech(c)
    slide_whitelabel(c)
    slide_pricing(c)
    slide_comparison(c)
    slide_cta(c)

    c.save()
    print(f"PDF saved: {OUT}")

if __name__ == "__main__":
    main()
