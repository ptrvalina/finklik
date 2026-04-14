"""Печатные формы первичных документов (PDF, ReportLab)."""
import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.pdf_service import _ensure_fonts


def _esc(text: str | None) -> str:
    if text is None:
        return ""
    return escape(str(text), {'"': "&quot;", "'": "&apos;"})


DOC_TITLE = {
    "invoice": "Счёт на оплату",
    "act": "Акт выполненных работ (оказанных услуг)",
    "waybill": "Товарная накладная",
}


@dataclass
class PrimaryDocumentPdfContext:
    doc_type: str
    doc_number: str
    status: str
    issue_date: date
    due_date: date | None
    currency: str
    amount_total: Decimal
    title: str | None
    description: str | None
    seller_name: str
    seller_unp: str
    seller_legal_form: str  # ip | ooo
    counterparty_name: str | None
    counterparty_unp: str | None
    counterparty_address: str | None
    related_invoice_number: str | None
    related_invoice_date: date | None


def _seller_label(legal_form: str) -> str:
    lf = (legal_form or "ip").lower()
    if lf == "ooo":
        return "Продавец (исполнитель)"
    return "Исполнитель (продавец)"


def _buyer_label(legal_form: str) -> str:
    lf = (legal_form or "ip").lower()
    if lf == "ooo":
        return "Покупатель (заказчик)"
    return "Заказчик (покупатель)"


def generate_primary_document_pdf(ctx: PrimaryDocumentPdfContext) -> bytes:
    """Формирует PDF первичного документа (шаблоны ИП / ООО — через реквизиты организации)."""
    buf = io.BytesIO()
    font = _ensure_fonts()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=15 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    title_st = ParagraphStyle(
        "pd_title",
        parent=styles["Title"],
        fontName=font,
        fontSize=14,
        spaceAfter=6 * mm,
    )
    normal = ParagraphStyle("pd_norm", parent=styles["Normal"], fontName=font, fontSize=10, leading=13)
    small = ParagraphStyle("pd_small", parent=styles["Normal"], fontName=font, fontSize=9, leading=11)
    head = ParagraphStyle(
        "pd_head",
        parent=styles["Normal"],
        fontName=font,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#111827"),
        spaceAfter=2,
    )

    lf = (ctx.seller_legal_form or "ip").lower()
    org_line = (
        f'ООО «{_esc(ctx.seller_name)}», УНП {_esc(ctx.seller_unp)}'
        if lf == "ooo"
        else f'ИП {_esc(ctx.seller_name)}, УНП {_esc(ctx.seller_unp)}'
    )

    kind_title = DOC_TITLE.get(ctx.doc_type, "Документ")
    header = f"{kind_title} № {_esc(ctx.doc_number)} от {ctx.issue_date.strftime('%d.%m.%Y')}"

    elems = [
        Paragraph(header, title_st),
        Paragraph(org_line, normal),
        Spacer(1, 4 * mm),
    ]

    if ctx.related_invoice_number:
        rel = f"Основание: счёт № {_esc(ctx.related_invoice_number)}"
        if ctx.related_invoice_date:
            rel += f" от {ctx.related_invoice_date.strftime('%d.%m.%Y')}"
        elems.append(Paragraph(rel + ".", small))
        elems.append(Spacer(1, 2 * mm))

    elems.append(Paragraph(_seller_label(lf), head))
    elems.append(Paragraph(org_line, normal))
    elems.append(Spacer(1, 3 * mm))

    if ctx.counterparty_name:
        elems.append(Paragraph(_buyer_label(lf), head))
        cp_lines = [_esc(ctx.counterparty_name)]
        if ctx.counterparty_unp:
            cp_lines.append(f"УНП: {_esc(ctx.counterparty_unp)}")
        if ctx.counterparty_address:
            cp_lines.append(_esc(ctx.counterparty_address))
        elems.append(Paragraph("<br/>".join(cp_lines), normal))
        elems.append(Spacer(1, 4 * mm))

    if ctx.title:
        elems.append(Paragraph(f"Наименование: {_esc(ctx.title)}", normal))
    if ctx.description:
        elems.append(Paragraph(f"Описание: {_esc(ctx.description)}", normal))

    status_ru = {
        "draft": "Черновик",
        "issued": "Выставлен",
        "paid": "Оплачен",
        "cancelled": "Отменён",
    }.get(ctx.status, ctx.status)

    amt = f"{ctx.amount_total:.2f}".replace(",", " ")
    tbl = Table(
        [
            ["Показатель", "Значение"],
            ["Статус", _esc(status_ru)],
            ["Сумма", f"{amt} {_esc(ctx.currency)}"],
            ["Срок оплаты", ctx.due_date.strftime("%d.%m.%Y") if ctx.due_date else "—"],
        ],
        colWidths=[55 * mm, 115 * mm],
    )
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a2332")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elems.append(Spacer(1, 4 * mm))
    elems.append(tbl)
    elems.append(Spacer(1, 8 * mm))
    elems.append(
        Paragraph(
            "Документ сформирован в ФинКлик. Подписи и печать — на бумажной копии при необходимости.",
            small,
        )
    )

    doc.build(elems)
    return buf.getvalue()
