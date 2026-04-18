# Технический бэклог: что делаем в репозитории без внешних сервисов

Порядок ниже — **рекомендуемый** (сначала стабильность и проверки, потом покрытие и полировка).  
Всё, что блокируется госAPI/банком/ЭЦП/облаком — в [`SPRINT_DEFERRED_EXTERNAL.md`](SPRINT_DEFERRED_EXTERNAL.md).

**Как вести:** отмечайте `- [ ]` → `- [x]` в PR или отдельными коммитами; при закрытии блока обновляйте этот файл.

---

## P0 — Стабильность и обязательные проверки

- [ ] Локально/в CI: `make verify-like-ci` (из корня репо) или эквивалент из [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) — зелёный прогон.
- [ ] На проде API: `alembic upgrade head` после каждого релиза с миграциями ([`DEPLOY_RUNBOOK.md`](DEPLOY_RUNBOOK.md) при наличии, иначе release notes).
- [ ] `make demo-smoke` / `python scripts/pre_demo_smoke.py` — зелёный; артефакт `artifacts/pre-demo-smoke-summary.md`.
- [ ] Ручной чеклист [`PRE_DEMO_SMOKE.md`](PRE_DEMO_SMOKE.md) перед важным демо.

---

## P1 — Тесты и регрессии (без моков госорганов)

- [x] Юнит-тесты OCR-разбора (`tests/unit/test_ocr_parse.py`) в зелёном наборе (`pytest tests/unit/`, [`pre_demo_smoke.py`](../../scripts/pre_demo_smoke.py)).
- [ ] Интеграционные тесты под **Python 3.11** (см. [`RELEASE_NOTES_SPRINT10.md`](RELEASE_NOTES_SPRINT10.md) про 3.14/bcrypt); не полагаться на 3.14 для auth до фикса стека.
- [ ] При изменении сканера/клиента: прогон связанных integration tests (`test_scanner.py`), если окружение поднимается.

---

## P2 — Качество кода и документации

- [ ] `flake8 app/` в `backend/api-gateway` без ошибок (как job **Backend Lint** в CI).
- [ ] `npm run build` фронта без ошибок TypeScript.
- [ ] Ссылки между `PRODUCT_SPRINT_ALIGNMENT`, release notes и этим файлом актуальны после крупных релизов.
- [ ] Новые фичи: краткая строка в соответствующем `RELEASE_NOTES_SPRINT*.md` или отдельном фрагменте dev-docs.

---

## P3 — Продуктовые улучшения только из кода (без внешних API)

Примеры (дополняйте по мере приоритета):

- [ ] Сканер: доработка эвристик `ocr_service` / UX формы после OCR (уже частично сделано — расширять по фидбеку).
- [ ] Настройки / подача отчётов: UX и сообщения об ошибках при `SUBMISSION_PORTAL_MODE=mock|http`.
- [ ] Документация для операторов: единый «где что лежит» в [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md).

---

## Явно не входит сюда

Повторная реализация пунктов из [`SPRINT_DEFERRED_EXTERNAL.md`](SPRINT_DEFERRED_EXTERNAL.md) до появления внешних контуров.
