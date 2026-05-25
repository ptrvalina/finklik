"""Координаты полей на изображении для UI-подсветки (нормализованные 0–1)."""

from __future__ import annotations

import re
from typing import Any

try:
    import pytesseract
    from pytesseract import Output
except Exception:  # pragma: no cover
    pytesseract = None
    Output = None  # type: ignore


def _norm_box(left: int, top: int, width: int, height: int, img_w: int, img_h: int) -> dict[str, float]:
    if img_w <= 0 or img_h <= 0:
        return {"left": 0, "top": 0, "width": 1, "height": 0.08}
    return {
        "left": round(max(0.0, left / img_w), 4),
        "top": round(max(0.0, top / img_h), 4),
        "width": round(min(1.0, width / img_w), 4),
        "height": round(min(1.0, height / img_h), 4),
    }


def _merge_boxes(boxes: list[dict[str, float]]) -> dict[str, float] | None:
    if not boxes:
        return None
    left = min(b["left"] for b in boxes)
    top = min(b["top"] for b in boxes)
    right = max(b["left"] + b["width"] for b in boxes)
    bottom = max(b["top"] + b["height"] for b in boxes)
    return {
        "left": left,
        "top": top,
        "width": round(min(1.0, right - left), 4),
        "height": round(min(1.0, bottom - top), 4),
    }


def _line_boxes(img_w: int, img_h: int, data: dict) -> list[tuple[str, dict[str, float]]]:
    """Строки OCR с объединённым bbox."""
    if not data or "text" not in data:
        return []
    n = len(data["text"])
    by_line: dict[tuple[int, int, int], list[int]] = {}
    for i in range(n):
        txt = (data["text"][i] or "").strip()
        if not txt:
            continue
        try:
            conf = int(float(data["conf"][i]))
        except (TypeError, ValueError):
            conf = -1
        if conf < 30:
            continue
        key = (int(data["block_num"][i]), int(data["par_num"][i]), int(data["line_num"][i]))
        by_line.setdefault(key, []).append(i)

    lines: list[tuple[str, dict[str, float]]] = []
    for indices in by_line.values():
        parts: list[str] = []
        boxes_px: list[tuple[int, int, int, int]] = []
        for i in indices:
            parts.append((data["text"][i] or "").strip())
            l, t, w, h = int(data["left"][i]), int(data["top"][i]), int(data["width"][i]), int(data["height"][i])
            boxes_px.append((l, t, w, h))
        if not parts:
            continue
        text = " ".join(parts)
        left = min(b[0] for b in boxes_px)
        top = min(b[1] for b in boxes_px)
        right = max(b[0] + b[2] for b in boxes_px)
        bottom = max(b[1] + b[3] for b in boxes_px)
        lines.append((text, _norm_box(left, top, right - left, bottom - top, img_w, img_h)))
    return lines


def _find_line_region(lines: list[tuple[str, dict[str, float]]], needle: str) -> dict[str, float] | None:
    if not needle or len(needle) < 2:
        return None
    low = needle.lower()
    hits = [box for txt, box in lines if low in txt.lower()]
    return _merge_boxes(hits)


def extract_field_regions(img: Any, parsed: dict[str, Any], ocr_text: str) -> dict[str, dict[str, float]]:
    """Подсветка полей на превью: counterparty, amount, date, unp."""
    if pytesseract is None or img is None:
        return {}
    try:
        data = pytesseract.image_to_data(img, lang="rus+eng", output_type=Output.DICT)
    except Exception:
        return {}

    img_w, img_h = img.size
    lines = _line_boxes(img_w, img_h, data)
    regions: dict[str, dict[str, float]] = {}

    cp = (parsed.get("counterparty_name") or "").strip()
    if cp:
        r = _find_line_region(lines, cp[: min(24, len(cp))])
        if r:
            regions["counterparty_name"] = r

    amount = parsed.get("amount")
    if amount:
        amt_s = f"{float(amount):.2f}".replace(".", ",")
        r = _find_line_region(lines, amt_s) or _find_line_region(lines, str(int(float(amount))))
        if r:
            regions["amount"] = r

    unp = parsed.get("unp")
    if unp:
        r = _find_line_region(lines, str(unp))
        if r:
            regions["unp"] = r

    tx_date = parsed.get("transaction_date")
    if tx_date:
        m = re.search(r"(\d{1,2})[./](\d{1,2})[./](\d{2,4})", str(tx_date))
        if m:
            r = _find_line_region(lines, m.group(0))
            if r:
                regions["transaction_date"] = r

    if not regions and ocr_text:
        # Fallback: верхняя треть — контрагент, нижняя — сумма.
        regions["counterparty_name"] = {"left": 0.05, "top": 0.08, "width": 0.9, "height": 0.12}
        if amount:
            regions["amount"] = {"left": 0.05, "top": 0.72, "width": 0.9, "height": 0.1}

    return regions
