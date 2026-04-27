# Этап 7 — OpenAPI и API-контракты

Этот документ фиксирует, как пользоваться новыми endpoint'ами workforce/auth и как поддерживать стабильный контракт API при развитии проекта.

## Где смотреть OpenAPI

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Сырой OpenAPI JSON: `http://localhost:8000/openapi.json`

## Ключевые endpoint'ы этапа 6/7

### Auth

- `POST /api/v1/auth/register` — регистрация owner + организации.
- `POST /api/v1/auth/login` — логин.
- `POST /api/v1/auth/refresh` — refresh access token.

Важно:
- `refresh_token` приходит в JSON и одновременно ставится в `httpOnly` cookie.
- `/auth/refresh` принимает refresh либо из тела (`refresh_token`), либо из cookie.

### Workforce

- `POST /api/v1/employees/{employee_id}/terminate`
- `POST /api/v1/fszn/pu2`
- `POST /api/v1/fszn/pu3`
- `POST /api/v1/salary/calculate`
- `GET /api/v1/salary/calculations`

Все endpoint'ы tenant-scoped и требуют Bearer JWT.

## CORS / cookie режим для продакшена

Для split frontend/backend:

- `CORS_ORIGINS=https://your-frontend.example.com`
- `REFRESH_COOKIE_SAMESITE=none`
- HTTPS обязателен (`Secure` cookie)

Для локальной разработки:

- `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`
- `REFRESH_COOKIE_SAMESITE=lax`

## Правила расширения API (чтобы не ломать фронт)

1. Не меняйте существующие поля ответов без deprecation-плана.
2. Новые поля в response добавляйте как backward-compatible (optional).
3. Для новых endpoint сразу добавляйте:
   - `summary`, `description`, `responses` в роутере;
   - интеграционный тест happy-path + 1 негативный кейс.
4. Любые auth/cookie изменения сопровождайте тестом `tests/integration/test_auth.py`.
5. Для CORS/безопасности обновляйте `app/core/config.py` + этот документ.

## Мини-чек перед PR

```bash
cd backend/api-gateway
python -m pytest tests/integration/test_auth.py -q
python -m pytest tests/unit/test_cors.py -q
python -m compileall app -q
```

