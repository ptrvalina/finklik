"""Prometheus-счётчики для сессий, auth и загрузок (без дублирования регистрации)."""

from __future__ import annotations

from prometheus_client import Counter

AUTH_FAILED_LOGIN_TOTAL = Counter(
    "finclick_auth_failed_login_total",
    "Неудачные попытки входа",
    ["reason"],
)

AUTH_REFRESH_REUSE_TOTAL = Counter(
    "finclick_auth_refresh_reuse_total",
    "Попытка refresh с устаревшим или повторно использованным jti",
)

UPLOAD_REJECTED_TOTAL = Counter(
    "finclick_upload_rejected_total",
    "Отклонённые загрузки (тип, размер, сигнатура)",
    ["endpoint"],
)

OCR_FAILED_TOTAL = Counter(
    "finclick_ocr_failed_total",
    "Сбой OCR после валидации файла",
    ["endpoint"],
)

SESSION_REVOKED_TOTAL = Counter(
    "finclick_session_revoked_total",
    "Инвалидация refresh-сессии (logout, смена пароля и т.п.)",
    ["reason"],
)
