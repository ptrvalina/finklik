# FinClick — Production Hardening & Pilot Readiness

Карта фаз из master prompt → статус в репозитории.

| Phase | Фокус | Статус |
|-------|--------|--------|
| 1 | Стабильность, jobs, verify, observability | 🟢 Основа |
| 2 | Учёт РБ, ledger, отчёты, закрытие периода | 🟢 Основа |
| 3 | OCR wow, vendor memory | 🟢 Основа |
| 4 | Pilot seeds, analytics hooks | 🟢 Основа |
| 5–6 | UX friction, execution speed | 🟡 Итерации по пилоту |
| 7 | Trust & governance | 🟡 Частично (audit + integrity) |
| 8 | Checklists & smoke | 🟢 `prod_verify.py`, `prod_smoke_full.py` |
| 9 | Позиционирование | Документ / продуктовые правила |

## Phase 1 — что в коде

- `app/services/integrity_service.py` — проверки ledger/транзакций
- `app/services/job_runner.py` — retry + Prometheus `finclick_job_*`
- `app/services/production_workers.py` — nightly integrity + amortization scheduler
- `app/services/startup_checks.py` — проверки при старте API
- `GET /api/v1/ops/diagnostics` + UI `/admin/ops`
- `scripts/prod_verify.py`

## Phase 2 — что в коде

- `chart_subaccounts_official_rb.json` + `seed_official_subaccounts_for_org`
- `ledger_engine.py` — валидация, закрытые периоды, сторно
- `accounting_reports_service.py` — ОСВ, trial balance, карточка счёта, журнал
- `period_close_service.py` — `POST /accounting/periods/{y}/{m}/close`
- `POST /accounting/ledger/preview`
- Миграция `production_hardening_v1`

## Phase 3 — OCR

- Vendor memory (`vendor_memory` table) + hints в ответе сканера
- Confidence/review — предыдущий Belarus FOS pass

## Phase 4 — Pilot

- `POST /api/v1/pilot/seed-template` — retail, it, services, horeca, logistics

## Deploy

```bash
cd backend/api-gateway && alembic upgrade head   # production_hardening_v1
python ../../scripts/prod_verify.py
# against running API:
SMOKE_EMAIL=... SMOKE_PASSWORD=... python ../../scripts/prod_smoke_full.py
```

## Ограничения (честно)

- Полный план счетов №50 со всеми субсчетами — шаблон + org subaccounts, не юридический полный корпус
- Job queue — in-process asyncio (не Celery); для scale см. `docs/pilot/scaling-plan.md`
- Impersonation / event replay — следующий PR support tooling
