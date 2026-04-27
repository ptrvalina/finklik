# Release Checklist — Stage 7

Короткий checklist перед/после релиза этапов 6-7 (auth cookie refresh, workforce, CORS hardening, OpenAPI/docs).

## 1) Pre-release (локально/CI)

- [ ] `python scripts/verify_like_ci.py` проходит.
- [ ] `cd backend/api-gateway && python -m pytest tests/integration/test_auth.py tests/unit/test_cors.py -q`
- [ ] `cd backend/api-gateway && python -m compileall app -q`
- [ ] OpenAPI доступен локально: `/docs`, `/redoc`, `/openapi.json`.

## 2) Infrastructure / env

- [ ] `JWT_SECRET_KEY` и `JWT_REFRESH_SECRET_KEY` не дефолтные `dev_*`.
- [ ] `CORS_ORIGINS` задан явным списком frontend origins.
- [ ] `CORS_ORIGIN_REGEX` включен только если реально нужны preview/tunnel домены.
- [ ] `REFRESH_COOKIE_SAMESITE`:
  - `none` для split-domain frontend/backend под HTTPS;
  - `lax` для single-site/локальной разработки.
- [ ] `ALLOWED_HOSTS` задан (если нужен TrustedHost guard на edge/proxy).

## 3) DB migrations

- [ ] `python -m alembic heads` без конфликтов.
- [ ] На target БД: `python -m alembic upgrade head`.
- [ ] Таблицы доступны: `audit_log`, `salary_calculations`, `fszn_reports` (+ новые поля employee).

## 4) Production smoke (безопасный)

- [ ] `GET /health` => `200`.
- [ ] `GET /api/v1/health` => `200`.
- [ ] `GET /openapi.json` => `200` и содержит `/api/v1/auth/refresh`.
- [ ] `GET /health?access_token=fake` => `400` (JWT query param block middleware).
- [ ] `POST /api/v1/auth/refresh` с пустым телом => `401` (нет refresh token).

## 5) Workforce smoke (controlled tenant)

Исполнять только на тестовом tenant/организации:

- [ ] `POST /api/v1/employees/{id}/terminate` => `200`/`404` ожидаемо.
- [ ] `POST /api/v1/fszn/pu2` => ответ с `protocol_id`, `status`.
- [ ] `POST /api/v1/salary/calculate` => запись и корректный response DTO.
- [ ] `GET /api/v1/salary/calculations` => список tenant-scoped.

## 6) Observability / rollback readiness

- [ ] Логи без всплеска `401/429/5xx` после релиза.
- [ ] Метрики `/metrics` доступны.
- [ ] Подготовлен rollback plan (snapshot БД/предыдущий образ).

