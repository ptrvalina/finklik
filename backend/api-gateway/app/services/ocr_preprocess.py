"""Предобработка изображений перед OCR (Belarus business documents)."""

from __future__ import annotations

import io

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
except Exception:  # pragma: no cover
    Image = None  # type: ignore


def preprocess_for_ocr(img: "Image.Image") -> "Image.Image":
    """
    grayscale → autocontrast → denoise → sharpen → optional deskew placeholder.
  Pillow-only pipeline for portability in Docker.
    """
    if Image is None:
        return img
    work = img.convert("L")
    work = ImageOps.autocontrast(work, cutoff=1)
    work = work.filter(ImageFilter.MedianFilter(size=3))
    work = ImageEnhance.Contrast(work).enhance(1.35)
    work = ImageEnhance.Sharpness(work).enhance(1.2)
    return work


def load_image_from_bytes(file_bytes: bytes) -> "Image.Image":
    if Image is None:
        raise RuntimeError("Pillow not available")
    return Image.open(io.BytesIO(file_bytes))
