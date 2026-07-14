# Ручной invite (если нет EMAIL_API_KEY)

Когда `EMAIL_API_KEY` не настроен, письма не уходят — используйте этот runbook.

## Вариант A — invite через UI (рекомендуется)

1. Войти как **owner** организации.
2. **Настройки → Команда → Пригласить**.
3. Указать email, роль (`accountant` / `manager` / `viewer`).
4. Если email не отправился — скопировать **ссылку приглашения** из ответа API/UI (или из логов API при `DEBUG=true`).

## Вариант B — API

```http
POST /api/v1/team/invites
Authorization: Bearer <owner_token>
Content-Type: application/json

{
  "email": "client@example.com",
  "role": "accountant"
}
```

Ответ содержит `accept_url` — отправить клиенту вручную (Telegram / SMS).

## Вариант C — регистрация owner (первая org)

1. `/register` — создаёт org + owner.
2. `/onboarding/business-profile` — обязательно до работы с налогами.
3. Optional: `POST /api/v1/pilot/seed-template` с `{ "template": "retail" }`.

## Чек перед первым входом клиента

- [ ] Ссылка invite не истекла  
- [ ] Клиент получил [PILOT_SCOPE.md](./PILOT_SCOPE.md)  
- [ ] `make pilot-check` → 🟢 или 🟡  

## После входа

См. [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) блок B.
