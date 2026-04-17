# Release Notes — Sprint 11 (Scanner & connectivity)

**Дата:** 2026-04-17  
**Версия веб-клиента:** 0.2.0

> Нумерация здесь — **фактический релиз** (сканер v0.2.0). Продуктовые «спринты 11–12» в дорожной карте (регламентированные отчёты и госпорталы) см. [`PRODUCT_SPRINT_ALIGNMENT.md`](PRODUCT_SPRINT_ALIGNMENT.md).

## Кратко

Релиз закрывает сбои сканера в продакшене (PostgreSQL), корректную загрузку `multipart/form-data`, устойчивость OCR-пайплайна и синхронизацию базы URL для WebSocket с REST-клиентом.

## Backend

- **Миграция `sprint10_scanned_documents`** (`alembic/versions/20260417_scanned_documents.py`): таблица `scanned_documents` для сохранения результатов сканирования. Ранее модель была в SQLAlchemy без ревизии Alembic → на Postgres ошибка вида `relation "scanned_documents" does not exist`.
- **`POST /scanner/upload`**: лимит файла **25 МБ** (как в UI); нормализация MIME (`application/octet-stream` / пустой тип по расширению `.pdf`, `.jpg`, …).
- **`ocr_service`**: после успешного Tesseract обёрнут разбор `parse_text_document`; при ошибке — mock fallback с `warnings` вместо 500. Ветка ТТН: `extract_ttn_data` в try/except → fallback на `_extract_generic`.

## Frontend

- **`scannerApi.upload` / `importApi`**: убран ручной заголовок `Content-Type: multipart/form-data` без `boundary` (ломало разбор тела на сервере).
- **`useWebSocket`**: база URL для WS считается через `resolveApiBase()` при подключении (как у axios), чтобы на GitHub Pages не уходить на `localhost`.

## Документация

- Презентация для банка: `docs/presentations/vtb-finklik-pitch/index.html` (опциональные скрины — `media/README.txt`).

## Обязательные действия при деплое

1. После выката API выполнить **`alembic upgrade head`** на целевой БД (Render и т.д.) — включая таблицы сканера и, после появления ревизии в репо, **регуляторные таблицы** (`sprint12_regulatory_reporting`: `regulatory_*`, `report_submissions`).
2. Выкатить фронт (GitHub Pages / Vercel) с версией **0.2.0**.

## Проверка после релиза

- Сканер: загрузка JPG/PDF, вкладка «Текст», список истории.
- Индикатор «Онлайн» в шапке при валидном `wss` к API.

## Совместимость

- Локальные интеграционные тесты backend: рекомендуется **Python 3.11** (см. Sprint 10 release notes по 3.14 / bcrypt).
