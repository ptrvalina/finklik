# FinClick — Runbook первого платящего клиента (РБ)

Короткий сценарий для SMB / бухгалтерской фирмы после деплоя Belarus FOS pass.

## 1. Перед демо (15 мин)

1. `alembic upgrade head` на целевой БД (цепочка `oked_org_profile_v1` → `belarus_fos_accounting_v1`).
2. `GET /health` и `GET /api/v1/health` → 200.
3. Создать тестовую организацию или использовать [DEMO_TENANT_CHECKLIST.md](./DEMO_TENANT_CHECKLIST.md).
4. Убедиться: `JWT_SECRET_KEY` / `CORS_ORIGINS` не dev-дефолты (см. [RELEASE_STAGE7_CHECKLIST.md](./RELEASE_STAGE7_CHECKLIST.md)).

## 2. Онбординг клиента (< 2 мин в UI)

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | Регистрация | Редирект на `/onboarding/business-profile` |
| 2 | ОКЭД + режим + штат | `BusinessProfileCompleted` в audit/events |
| 3 | 1–3 операции в журнал | `/accounting` |
| 4 | Скан документа | `/scan`, при низкой уверенности — подсветка полей |
| 5 | Лента работы | `/operations` — work packs, trust surface |

## 3. Бухгалтер (расширенный режим)

1. Настройки → **Расширенный (план счетов)**.
2. Учёт → **План счетов** (`/accounting/chart`).
3. При необходимости: субсчета, проводки (API `POST /accounting/ledger`).
4. ОС: `POST /accounting/amortization/run?year=&month=` (или UI позже).

## 4. Smoke API (curl / Postman)

```http
GET  /api/v1/oked/popular
GET  /api/v1/team/organization/business-profile
PATCH /api/v1/team/organization/business-profile  { "oked_primary": "62.01", "mark_completed": true }
GET  /api/v1/accounting/chart/tree
GET  /api/v1/accounting/mode
PATCH /api/v1/accounting/mode  { "accounting_mode": "advanced" }
POST /api/v1/scanner/upload  (multipart)
POST /api/v1/operations/work-packs/{id}/ack
```

## 5. Что честно сказать клиенту

- План счетов — **версионированный справочник** по Приказу №50 (синтетика + субсчета организации); полная юридическая сверка — отдельная задача данных.
- ОКЭД — популярные коды в seed; полный Belstat CSV — импорт по запросу.
- Госпорталы / ЭЦП / XSD — по [SPRINT_DEFERRED_EXTERNAL.md](./SPRINT_DEFERRED_EXTERNAL.md).

## 6. Эскалация

- OCR 503: Tesseract на сервере, размер/формат файла.
- 403 на профиль: роль owner/admin.
- Миграции: `alembic heads` — один head перед релизом.
