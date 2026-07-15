# Production gate — 🟢 pilot-check

Как получить **🟢 Ready for Pilot** на production (или production-like стенде).

---

## Что требует scorecard (production)

| Блок | Условие 🟢 |
|------|------------|
| Infrastructure | `GET /health` и `/api/v1/health` → 200 |
| PostgreSQL | `DATABASE_URL` с `postgresql` (не SQLite) |
| Secrets | JWT не dev-дефолты, `DEBUG=false` |
| Email | `EMAIL_API_KEY` не пустой |
| OCR | `test_ocr_parse` PASS |
| Bank import | Mock bank `/health` или OAuth |
| Reporting | `SUBMISSION_PORTAL_MODE=mock` + capabilities |
| Demo smoke | alembic + pytest + `npm run build` |
| Known limitations | `PILOT_LIMITATIONS_ACK=1` + `PILOT_SCOPE.md` |

Email может быть placeholder на staging (ключ непустой); для реальных invite — Resend/SendGrid.

---

## Вариант A — локальный production-like (Docker)

```bash
# 1. Docker Desktop запущен
make pilot-prod-gate
```

Скрипт `scripts/pilot_prod_gate.py`:

1. Создаёт `backend/api-gateway/.env.pilot.local` (секреты, email key)
2. Поднимает `infrastructure/docker/docker-compose.pilot.yml` (PG :5433, API :8010, mock bank :8011)
3. Запускает `PILOT_TARGET=production PILOT_LIMITATIONS_ACK=1 make pilot-check`

Остановить стек:

```bash
python scripts/pilot_prod_gate.py --down
```

С Playwright:

```bash
make pilot-prod-gate-e2e
```

---

## Вариант B — реальный хостинг (Render / VPS)

1. Скопировать [`.env.pilot.example`](../../backend/api-gateway/.env.pilot.example) → secrets хостинга
2. Задать:
   - `DATABASE_URL=postgresql+asyncpg://...`
   - `JWT_SECRET_KEY` / `JWT_REFRESH_SECRET_KEY` — `python -c "import secrets; print(secrets.token_hex(32))"`
   - `EMAIL_API_KEY` — ключ провайдера
   - `DEBUG=false`
   - `MOCK_BANK_URL` — URL mock bank или настроить OAuth
   - `CORS_ORIGINS` — URL фронта
3. Применить миграции: `alembic upgrade head`
4. Проверка с рабочей машины:

```bash
PILOT_API_URL=https://your-api.example.com \
PILOT_TARGET=production \
PILOT_LIMITATIONS_ACK=1 \
PILOT_ENV_FILE=backend/api-gateway/.env.pilot.local \
make pilot-check
```

`PILOT_ENV_FILE` — локальный файл с теми же secrets, что на сервере (не коммитить).

---

## Playwright E2E

```bash
cd frontend/web
npm ci
npm run test:e2e:install
make pilot-e2e
```

CI: job `pilot-e2e` в `.github/workflows/ci.yml`.

Включить E2E в scorecard:

```bash
PILOT_RUN_E2E=1 make pilot-check
```

---

## Чеклист перед первым клиентом

1. 🟢 или 🟡 `make pilot-check` / `make pilot-prod-gate`
2. `make pilot-e2e` (или CI green)
3. [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)
4. [PILOT_SCOPE.md](./PILOT_SCOPE.md) клиенту
5. Invite: email или [MANUAL_INVITE_RUNBOOK.md](./MANUAL_INVITE_RUNBOOK.md)
