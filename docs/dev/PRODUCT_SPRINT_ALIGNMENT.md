# Соответствие продуктовых спринтов и релизов

В [`docs/pilot/scaling-plan.md`](../pilot/scaling-plan.md) нумерация спринтов 4–18 — **продуктовая дорожная карта**. В [`docs/dev/RELEASE_NOTES_SPRINT*.md`](.) фиксируются **фактические итерации** выката (они могут расходиться по номеру и теме).

**Планирование в коде:** что откладывается до внешних сервисов — [`SPRINT_DEFERRED_EXTERNAL.md`](SPRINT_DEFERRED_EXTERNAL.md); упорядоченный техбэклог без внешних зависимостей — [`TECH_CATCHUP_ORDERED.md`](TECH_CATCHUP_ORDERED.md).

## Продуктовые спринты 11–12 (отчётность и порталы)

| Продукт (scaling-plan) | Смысл | Состояние в репозитории |
|------------------------|--------|-------------------------|
| **Спринт 11.** Регламентированные отчёты | Реальные форматы, заполнение из учёта, предпросмотр, валидация, версии форм | **Без внешних API сделано:** экспорт [`export.py`](../../backend/api-gateway/app/api/v1/endpoints/export.py), ПУ-3 через [`pu3_aggregation.py`](../../backend/api-gateway/app/services/pu3_aggregation.py), калькулятор [`tax_calculator.py`](../../backend/api-gateway/app/services/tax_calculator.py), черновики подачи из учёта. **Отложено до внешних контуров:** XML/XSD, валидация по схемам, версионирование нормативки, расширенное редактирование — [`SPRINT_DEFERRED_EXTERNAL.md`](SPRINT_DEFERRED_EXTERNAL.md). |
| **Спринт 12.** Госпорталы | Интеграция с порталами, ЭЦП, статусы, архив | **Без реальных порталов сделано:** пайплайн [`report_submission.py`](../../backend/api-gateway/app/api/v1/endpoints/report_submission.py), mock/http-адаптер, WS+email, UI [`SettingsPage.tsx`](../../frontend/web/src/pages/SettingsPage.tsx), **архивный снимок** на submit + `GET /submissions/{id}`. **Отложено:** реальные API, ЭЦП, очередь, S3-квитанции, WS на фронте — [`SPRINT_DEFERRED_EXTERNAL.md`](SPRINT_DEFERRED_EXTERNAL.md). |

## Инфраструктура для продакшена

После миграций на целевой БД выполнить **`alembic upgrade head`** (в т.ч. `submission_archive_snapshot` для колонки `submission_snapshot_json`).

## Фактический релиз «Sprint 11» в нотах

См. [`RELEASE_NOTES_SPRINT11.md`](RELEASE_NOTES_SPRINT11.md) — итерация **v0.2.0** (сканер, multipart, WebSocket). Это не то же самое, что «продуктовый спринт 11» в scaling-plan.
