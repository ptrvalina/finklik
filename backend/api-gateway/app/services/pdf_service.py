"""PDF report generation using reportlab."""
import io
from datetime import date
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def _ensure_fonts():
    """Register fonts if available, fallback to Helvetica."""
    try:
        pdfmetrics.getFont("DejaVuSans")
    except KeyError:
        import os
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
        for path in font_paths:
            if os.path.exists(path):
                pdfmetrics.registerFont(TTFont("DejaVuSans", path))
                pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", path.replace("Sans.", "Sans-Bold.")))
                return "DejaVuSans"
        return "Helvetica"
    return "DejaVuSans"


def _fmt(n: float | Decimal) -> str:
    return f"{float(n):,.2f}".replace(",", " ")


def generate_financial_report_pdf(
    org_name: str,
    unp: str,
    period_start: date,
    period_end: date,
    income: float,
    expense: float,
    tax_usn: float,
    tax_vat: float,
    transactions: list[dict],
) -> bytes:
    """Generate a financial summary PDF report."""
    buf = io.BytesIO()
    font_name = _ensure_fonts()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=15 * mm,
                            leftMargin=15 * mm, rightMargin=15 * mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title_Custom", parent=styles["Title"], fontName=font_name,
                                  fontSize=16, spaceAfter=5 * mm)
    normal = ParagraphStyle("Normal_Custom", parent=styles["Normal"], fontName=font_name, fontSize=10)
    heading = ParagraphStyle("Heading_Custom", parent=styles["Heading2"], fontName=font_name,
                              fontSize=12, spaceBefore=8 * mm, spaceAfter=3 * mm)

    elements = []

    elements.append(Paragraph(f"Финансовый отчёт", title_style))
    elements.append(Paragraph(f"{org_name} (УНП: {unp})", normal))
    elements.append(Paragraph(f"Период: {period_start} — {period_end}", normal))
    elements.append(Spacer(1, 8 * mm))

    profit = income - expense
    summary_data = [
        ["Показатель", "Сумма (BYN)"],
        ["Доходы", _fmt(income)],
        ["Расходы", _fmt(expense)],
        ["Прибыль", _fmt(profit)],
        ["УСН 3%", _fmt(tax_usn)],
        ["НДС к уплате", _fmt(tax_vat)],
    ]
    summary_table = Table(summary_data, colWidths=[100 * mm, 60 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a2332")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)

    if transactions:
        elements.append(Paragraph("Операции", heading))

        tx_header = ["Дата", "Тип", "Описание", "Сумма (BYN)"]
        tx_rows = [tx_header]
        for tx in transactions[:100]:
            type_label = {"income": "Доход", "expense": "Расход", "refund": "Возврат", "writeoff": "Списание"}.get(tx.get("type", ""), tx.get("type", ""))
            desc = tx.get("description", "")[:40]
            tx_rows.append([
                str(tx.get("transaction_date", "")),
                type_label,
                desc,
                _fmt(tx.get("amount", 0)),
            ])

        tx_table = Table(tx_rows, colWidths=[25 * mm, 22 * mm, 80 * mm, 35 * mm])
        tx_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a2332")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (3, 0), (3, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddd")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(tx_table)

    elements.append(Spacer(1, 10 * mm))
    from datetime import datetime
    elements.append(Paragraph(f"Сформировано: {datetime.now().strftime('%d.%m.%Y %H:%M')}", normal))

    doc.build(elements)
    return buf.getvalue()
