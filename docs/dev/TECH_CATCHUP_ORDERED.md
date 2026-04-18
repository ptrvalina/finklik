# Технический бэклог: что делаем в репозитории без внешних сервисов

Порядок ниже — **рекомендуемый** (сначала стабильность и проверки, потом покрытие и полировка).  
Всё, что блокируется госAPI/банком/ЭЦП/облаком — в [`SPRINT_DEFERRED_EXTERNAL.md`](SPRINT_DEFERRED_EXTERNAL.md).

**Как вести:** при новых хвостах добавляйте строки в P2/P3; закрытые пункты оставляйте `[x]`.

---

## P0 — Стабильность и обязательные проверки

- [x] Локально/в CI: `make verify-like-ci` или `python scripts/verify_like_ci.py` (подхват `.venv311`) — набор как в [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) job **Backend Tests** (включая `test_scanner`).
- [x] **Прод:** после каждого релиза с миграциями выполнять `alembic upgrade head` на целевой БД — пошагово в [`DEPLOY_RUNBOOK.md`](DEPLOY_RUNBOOK.md) (автоматизировать из репозитория нельзя).
- [x] `make demo-smoke` / `python scripts/pre_demo_smoke.py` — зелёный прогон; сводка в `artifacts/pre-demo-smoke-summary.md` (каталог в `.gitignore`).
- [ ] Ручной чеклист [`PRE_DEMO_SMOKE.md`](PRE_DEMO_SMOKE.md) перед важным демо (остаётся ручным).

---

## P1 — Тесты и регрессии (без моков госорганов)

- [x] Юнит-тесты OCR-разбора (`tests/unit/test_ocr_parse.py`) в зелёном наборе (`pytest tests/unit/`, [`pre_demo_smoke.py`](../../scripts/pre_demo_smoke.py)).
- [x] Интеграционные тесты с **Python 3.11** (см. [`RELEASE_NOTES_SPRINT10.md`](RELEASE_NOTES_SPRINT10.md)); для локали — `backend/api-gateway/.venv311` или `pip install -r requirements-dev.txt`.
- [x] Сканер: интеграционные тесты `tests/integration/test_scanner.py` входят в CI и в `verify-like-ci` / `verify_like_ci.py`.

---

## P2 — Качество кода и документации

- [x] `flake8 app/` в `backend/api-gateway` — как job **Backend Lint** в CI; локально: `pip install -r requirements-dev.txt` затем `python -m flake8 app/ ...`.
- [x] `npm run build` фронта без ошибок TypeScript.
- [x] Ссылки между `PRODUCT_SPRINT_ALIGNMENT`, release notes, `SPRINT_DEFERRED_EXTERNAL`, этим файлом и [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) согласованы.
- [x] Точка входа для разработчика: таблица «Навигация по документации» в [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md).

---

## P3 — Продуктовые улучшения только из кода (без внешних API)

- [x] Сканер: эвристики `ocr_service`, редактируемая форма после OCR — реализовано в текущем `main` (доработки — по фидбеку, не блокер).
- [x] Подача отчётов: mock/http-режимы, WS, архив снимка — в коде; сообщения об ошибках портала покрывают сетевые 502/503 в сервисе подачи.
- [x] Документация для разработчиков: см. разделы выше и навигацию в `DEVELOPER_GUIDE.md`.

---

## Явно не входит сюда

Повторная реализация пунктов из [`SPRINT_DEFERRED_EXTERNAL.md`](SPRINT_DEFERRED_EXTERNAL.md) до появления внешних контуров.
