# ФинКлик (FinKlik)

Веб-платформа учёта и отчётности для ИП/организаций (РБ): операции, налоги, сканер документов, подача отчётов (mock/http-адаптер до подключения реальных госпорталов).

## Быстрый старт

```bash
bash scripts/bootstrap.sh   # Python venv, npm, .env для api-gateway
make dev                    # Docker: API, фронт, mock-банк, mock-1С
```

Фронт по умолчанию: **http://localhost:5173**, API: **http://localhost:8000/docs**.

Подробнее: [`docs/dev/DEVELOPER_GUIDE.md`](docs/dev/DEVELOPER_GUIDE.md).

### Переменные окружения API (`backend/api-gateway`)

Задаются в `.env` в корне репозитория (см. `scripts/bootstrap.sh`) или в окружении процесса. Основные:

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | Async SQLAlchemy URL (по умолчанию SQLite `sqlite+aiosqlite:///./finklik.db`) |
| `DEBUG` | Режим отладки; для исходящих URL влияет на проверки (например http vs https) |
| `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY` | Подпись access/refresh токенов |
| `REDIS_URL` | Кэш (при недоступности Redis кэш отключается) |
| `CORS_ORIGINS` | Явный список origins (CSV или JSON-массив); каждый проходит проверку |
| `CORS_ORIGIN_REGEX` | Дополнительные origins по regex (preview); пустая строка — отключить |
| `CORS_PREFLIGHT_MAX_AGE` | Кэш ответа на OPTIONS (сек), по умолчанию 600 |
| `ALLOWED_HOSTS` | Разрешённые значения заголовка `Host` (через запятую); пусто — проверка выключена |
| `REFRESH_COOKIE_SAMESITE` | `lax` / `strict` / `none` — для фронта на другом домене с HTTPS обычно `none` |
| `MOCK_BANK_URL`, `ONEC_MOCK_URL` | URL мок-сервисов в dev |
| `EMAIL_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL` | Почта и ссылки в письмах |
| `OPENAI_API_KEY` | Чат-ассистент (пусто — демо-ответы) |
| `PAYMENT_WEBHOOK_SECRET` | Секрет вебхука оплаты счёта (`X-Payment-Webhook-Secret`) |
| `PROVISION_ADMIN_TOKEN`, `PROVISION_WEBHOOK_SECRET` | Админ- и вебхук-провижин 1С |
| `SUBMISSION_PORTAL_MODE`, `SUBMISSION_PORTAL_BASE_URL` | Режим подачи отчётов: `mock` или `http` |
| `NBRB_FX_ENABLED`, `NBRB_FX_REFRESH_SECONDS` | Курсы НБ РБ: фоновое обновление (0 — только по запросу) |

Полный список полей — класс `Settings` в `backend/api-gateway/app/core/config.py`.

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
| API/OpenAPI (этап 7) | [`docs/dev/API_OPENAPI_STAGE7.md`](docs/dev/API_OPENAPI_STAGE7.md) |
| Релизный чеклист (этап 7) | [`docs/dev/RELEASE_STAGE7_CHECKLIST.md`](docs/dev/RELEASE_STAGE7_CHECKLIST.md) |
| Прод-smoke отчёт (этап 7) | [`docs/dev/SMOKE_STAGE7_PROD_2026-04-27.md`](docs/dev/SMOKE_STAGE7_PROD_2026-04-27.md) |
| Техбэклог без внешних API | [`docs/dev/TECH_CATCHUP_ORDERED.md`](docs/dev/TECH_CATCHUP_ORDERED.md) |
| Отложено до госAPI/ЭЦП/инфры | [`docs/dev/SPRINT_DEFERRED_EXTERNAL.md`](docs/dev/SPRINT_DEFERRED_EXTERNAL.md) |
| Деплой | [`docs/dev/DEPLOY_RUNBOOK.md`](docs/dev/DEPLOY_RUNBOOK.md) |
| Дорожная карта | [`docs/pilot/scaling-plan.md`](docs/pilot/scaling-plan.md) |

## Репозиторий

- `backend/api-gateway` — FastAPI, Alembic, тесты в `tests/`.
- `frontend/web` — React (Vite), v0.2.0.
- `.github/workflows` — CI (тесты, линт, сборка фронта, smoke курсов НБ РБ, GitHub Pages).
