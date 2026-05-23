# FinClick — Резервное копирование и аудит

## База данных

- **Перед релизом Belarus FOS:** snapshot PostgreSQL (Render / managed PG).
- **Миграции:** только `alembic upgrade head` вперёд; откат — restore snapshot + предыдущий образ API.
- **Критичные таблицы:** `organizations`, `users`, `transactions`, `chart_accounts`, `ledger_entries`, `scanned_documents`, `audit_log`, `domain_events` (если есть).

## Audit log

- Действия сканера: `scan_uploaded`, `scan_uploaded_to_kudir`.
- Профиль: события `OkedSelected`, `TaxModeSelected`, `BusinessProfileCompleted`.
- Учёт: `AccountCreated`, `SubaccountCreated`, `AmortizationGenerated` (см. `app/events/constants.py`).
- Просмотр: таблица `audit_log`, колонка `payload` (не `metadata`).

## Файлы и OCR

- Сканеры хранят метаданные в `scanned_documents`; бинарники — по текущей политике деплоя (часто только in-memory при upload).
- Не коммитить `.env`, ключи JWT, refresh secrets.

## Мониторинг после релиза

- `/metrics` — всплески `401`, `429`, `5xx`.
- `OCR_FAILED_TOTAL`, `UPLOAD_REJECTED_TOTAL` (Prometheus labels).
- Логи correlation id: middleware `app/security/correlation.py`.

## RPO / RTO (ориентир для первых клиентов)

| | Цель |
|---|------|
| RPO | ≤ 24 ч (daily backup) |
| RTO | ≤ 4 ч (restore + smoke из RELEASE_STAGE7) |

Уточняйте SLA с хостингом (Render snapshot policy).
