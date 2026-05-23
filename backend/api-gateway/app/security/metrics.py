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

JOB_SUCCESS_TOTAL = Counter("finclick_job_success_total", "Успешные фоновые задачи", ["job"])
JOB_FAILED_TOTAL = Counter("finclick_job_failed_total", "Сбои фоновых задач", ["job", "reason"])
JOB_RETRY_TOTAL = Counter("finclick_job_retry_total", "Повторы фоновых задач", ["job"])
JOB_DEAD_LETTER_TOTAL = Counter("finclick_job_dead_letter_total", "Исчерпаны попытки задачи", ["job"])

REPORT_FAILED_TOTAL = Counter("finclick_report_failed_total", "Сбои отчётности", ["authority"])
INTEGRITY_CHECK_FAILED_TOTAL = Counter(
    "finclick_integrity_check_failed_total",
    "Проваленные проверки целостности",
    ["check"],
)
