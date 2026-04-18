# Соответствие продуктовых спринтов и релизов

В [`docs/pilot/scaling-plan.md`](../pilot/scaling-plan.md) нумерация спринтов 4–18 — **продуктовая дорожная карта**. В [`docs/dev/RELEASE_NOTES_SPRINT*.md`](.) фиксируются **фактические итерации** выката (они могут расходиться по номеру и теме).

## Продуктовые спринты 11–12 (отчётность и порталы)

| Продукт (scaling-plan) | Смысл | Состояние в репозитории |
|------------------------|--------|-------------------------|
| **Спринт 11.** Регламентированные отчёты | Реальные форматы, заполнение из учёта, предпросмотр, валидация, версии форм | Частично: экспорт [`export.py`](../../backend/api-gateway/app/api/v1/endpoints/export.py) (`tax-report.txt`, `vat-declaration.txt`, `fsszn-pu3.txt`, PDF), ПУ-3: единая агрегация зарплаты [`pu3_aggregation.py`](../../backend/api-gateway/app/services/pu3_aggregation.py) для экспорта и черновика подачи; калькулятор [`tax_calculator.py`](../../backend/api-gateway/app/services/tax_calculator.py). Нет полноценных XML/официальных схем и версионирования нормативки. |
| **Спринт 12.** Госпорталы | Интеграция с порталами, ЭЦП, статусы, архив | Частично: мок-пайплайн [`report_submission.py`](../../backend/api-gateway/app/api/v1/endpoints/report_submission.py), черновик заполняется из учёта (`report_data.source`: `ledger`), UI **Настройки → Подача отчётов** [`SettingsPage.tsx`](../../frontend/web/src/pages/SettingsPage.tsx). Реальных API порталов и ЭЦП нет. |

## Инфраструктура для продакшена

После добавления миграции `sprint12_regulatory_reporting` на целевой БД нужно выполнить **`alembic upgrade head`**, иначе на Postgres отсутствуют таблицы `regulatory_updates`, `regulatory_notifications`, `report_submissions`.

## Фактический релиз «Sprint 11» в нотах

См. [`RELEASE_NOTES_SPRINT11.md`](RELEASE_NOTES_SPRINT11.md) — итерация **v0.2.0** (сканер, multipart, WebSocket). Это не то же самое, что «продуктовый спринт 11» в scaling-plan.
