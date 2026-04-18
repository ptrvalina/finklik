# ФинКлик (FinKlik)

Веб-платформа учёта и отчётности для ИП/организаций (РБ): операции, налоги, сканер документов, подача отчётов (mock/http-адаптер до подключения реальных госпорталов).

## Быстрый старт

```bash
bash scripts/bootstrap.sh   # Python venv, npm, .env для api-gateway
make dev                    # Docker: API, фронт, mock-банк, mock-1С
```

Фронт по умолчанию: **http://localhost:5173**, API: **http://localhost:8000/docs**.

Подробнее: [`docs/dev/DEVELOPER_GUIDE.md`](docs/dev/DEVELOPER_GUIDE.md).

## Проверки перед коммитом / релизом

```bash
# Backend как в CI (Alembic + unit + интеграции metrics/submissions/scanner)
python scripts/verify_like_ci.py
# или из корня с make:
make verify-like-ci
```

Зависимости для линта и полного pytest: `pip install -r backend/api-gateway/requirements.txt -r backend/api-gateway/requirements-dev.txt`.

Фронт: `cd frontend/web && npm run build` (или `npm run typecheck` — только TypeScript).

Демо-smoke: `make demo-smoke` → [`docs/dev/PRE_DEMO_SMOKE.md`](docs/dev/PRE_DEMO_SMOKE.md).

## Документация

| Раздел | Файл |
|--------|------|
| Разработка | [`docs/dev/DEVELOPER_GUIDE.md`](docs/dev/DEVELOPER_GUIDE.md) |
| Техбэклог без внешних API | [`docs/dev/TECH_CATCHUP_ORDERED.md`](docs/dev/TECH_CATCHUP_ORDERED.md) |
| Отложено до госAPI/ЭЦП/инфры | [`docs/dev/SPRINT_DEFERRED_EXTERNAL.md`](docs/dev/SPRINT_DEFERRED_EXTERNAL.md) |
| Деплой | [`docs/dev/DEPLOY_RUNBOOK.md`](docs/dev/DEPLOY_RUNBOOK.md) |
| Дорожная карта | [`docs/pilot/scaling-plan.md`](docs/pilot/scaling-plan.md) |

## Репозиторий

- `backend/api-gateway` — FastAPI, Alembic, тесты в `tests/`.
- `frontend/web` — React (Vite), v0.2.0.
- `.github/workflows` — CI (тесты, линт, сборка фронта, GitHub Pages).
