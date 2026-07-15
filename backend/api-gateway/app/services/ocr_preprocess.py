"""Предобработка изображений перед OCR (Belarus business documents)."""

from __future__ import annotations

import io

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
except Exception:  # pragma: no cover
    Image = None  # type: ignore


def _smart_crop(img: "Image.Image", margin_pct: float = 0.02) -> "Image.Image":
    """Обрезка пустых полей по контрасту (упрощённо)."""
    if Image is None:
        return img
    gray = img.convert("L")
    bbox = gray.getbbox()
    if not bbox:
        return img
    w, h = img.size
    pad_x = int(w * margin_pct)
    pad_y = int(h * margin_pct)
    left = max(0, bbox[0] - pad_x)
    top = max(0, bbox[1] - pad_y)
    right = min(w, bbox[2] + pad_x)
    bottom = min(h, bbox[3] + pad_y)
    if right - left < w * 0.25 or bottom - top < h * 0.25:
        return img
    return img.crop((left, top, right, bottom))


def _adaptive_threshold(img: "Image.Image") -> "Image.Image":
    if Image is None:
        return img
    return ImageOps.autocontrast(img.convert("L"), cutoff=2)


def _deskew_projection(img: "Image.Image", max_angle: float = 4.0, step: float = 1.0) -> "Image.Image":
    """Лёгкий подбор угла по дисперсии горизонтальной проекции (без OpenCV)."""
    if Image is None:
        return img
    gray = img.convert("L")
    best_angle = 0.0
    best_score = -1.0
    angle = -max_angle
    while angle <= max_angle:
        rotated = gray.rotate(angle, expand=True, fillcolor=255)
        hist = rotated.histogram()
        dark = sum(hist[:200])
        score = dark / max(1, sum(hist))
        if score > best_score:
            best_score = score
            best_angle = angle
        angle += step
    if abs(best_angle) >= 0.5:
        return img.rotate(best_angle, expand=True, fillcolor=(255, 255, 255))
    return img


def _deskew_osd(img: "Image.Image") -> "Image.Image":
    """Поворот по OSD Tesseract (если доступен)."""
    if Image is None:
        return img
    try:
        import pytesseract

        osd = pytesseract.image_to_osd(img, output_type=pytesseract.Output.STRING)
        angle = 0.0
        for line in osd.splitlines():
            if "Rotate:" in line:
                angle = float(line.split(":", 1)[1].strip())
                break
        if abs(angle) >= 0.5:
            return img.rotate(-angle, expand=True, fillcolor=(255, 255, 255))
    except Exception:
        pass
    return img


def preprocess_for_ocr(img: "Image.Image", *, doc_hint: str = "") -> "Image.Image":
    """
    EXIF → deskew → crop → adaptive contrast → denoise → sharpen.
    Для чеков — чуть сильнее резкость.
    """
    if Image is None:
        return img
    work = img.convert("RGB")
    try:
        work = ImageOps.exif_transpose(work)
    except Exception:
        pass
    work = _deskew_osd(work)
    work = _deskew_projection(work)
    work = _smart_crop(work)
    work = _adaptive_threshold(work)
    work = work.filter(ImageFilter.MedianFilter(size=3))
    contrast = 1.45 if doc_hint == "receipt" else 1.35
    work = ImageEnhance.Contrast(work).enhance(contrast)
    sharp = 1.35 if doc_hint in ("receipt", "invoice") else 1.2
    work = ImageEnhance.Sharpness(work).enhance(sharp)
    return work


def load_image_from_bytes(file_bytes: bytes) -> "Image.Image":
    if Image is None:
        raise RuntimeError("Pillow not available")
    if len(file_bytes) >= 12 and file_bytes[4:8] == b"ftyp":
        try:
            from pillow_heif import register_heif_opener

            register_heif_opener()
        except Exception:
            pass
    return Image.open(io.BytesIO(file_bytes))
