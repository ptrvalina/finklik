# Соответствие продуктовых спринтов и релизов

В [`docs/pilot/scaling-plan.md`](../pilot/scaling-plan.md) нумерация спринтов 4–18 — **продуктовая дорожная карта**. В [`docs/dev/RELEASE_NOTES_SPRINT*.md`](.) фиксируются **фактические итерации** выката (они могут расходиться по номеру и теме).

## Продуктовые спринты 11–12 (отчётность и порталы)

| Продукт (scaling-plan) | Смысл | Состояние в репозитории |
|------------------------|--------|-------------------------|
| **Спринт 11.** Регламентированные отчёты | Реальные форматы, заполнение из учёта, предпросмотр, валидация, версии форм | **Без внешних API сделано:** экспорт [`export.py`](../../backend/api-gateway/app/api/v1/endpoints/export.py), ПУ-3 через [`pu3_aggregation.py`](../../backend/api-gateway/app/services/pu3_aggregation.py), калькулятор [`tax_calculator.py`](../../backend/api-gateway/app/services/tax_calculator.py), черновики подачи из учёта. **В бэклог спринта 18:** XML/официальные схемы, валидация по схемам, версионирование нормативки, расширенное редактирование — [`BACKLOG_SPRINT18_DEFERRED.md`](BACKLOG_SPRINT18_DEFERRED.md). |
| **Спринт 12.** Госпорталы | Интеграция с порталами, ЭЦП, статусы, архив | **Без реальных порталов сделано:** пайплайн [`report_submission.py`](../../backend/api-gateway/app/api/v1/endpoints/report_submission.py), mock/http-адаптер, WS+email, UI [`SettingsPage.tsx`](../../frontend/web/src/pages/SettingsPage.tsx), **архивный снимок** на submit + `GET /submissions/{id}`. **В бэклог спринта 18:** реальные API, ЭЦП, очередь, S3-квитанции, UI для WS — [`BACKLOG_SPRINT18_DEFERRED.md`](BACKLOG_SPRINT18_DEFERRED.md). |

## Инфраструктура для продакшена

После миграций на целевой БД выполнить **`alembic upgrade head`** (в т.ч. `submission_archive_snapshot` для колонки `submission_snapshot_json`).

## Фактический релиз «Sprint 11» в нотах

См. [`RELEASE_NOTES_SPRINT11.md`](RELEASE_NOTES_SPRINT11.md) — итерация **v0.2.0** (сканер, multipart, WebSocket). Это не то же самое, что «продуктовый спринт 11» в scaling-plan.
