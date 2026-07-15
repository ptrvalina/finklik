# FinKlik — Pilot Ready Status

**Обновлено:** 2026-07-15  
**Цель:** первая волна 5–15 организаций

---

## Критерии готовности (код)

| Критерий | Статус |
|----------|--------|
| P0 product logic (главная 4 вопроса) | ✅ |
| P0 nav (journal default, control redirect) | ✅ |
| P0 scope + manual invite runbook | ✅ |
| P0/P1 copy (checklist, без % в owner UI) | ✅ |
| Workflow bar (scan → journal → reports) | ✅ |
| Inbox + approvals unified | ✅ |
| Accountant entry → `/workspace/queues` | ✅ |
| WS `report_status` → toast + refresh reporting | ✅ |
| Dead accounting Hub removed | ✅ |
| Accept-invite → полная сессия (auth store) | ✅ |
| Invite: копирование ссылки в UI | ✅ |
| Owner без «Очередей клиентов» в nav | ✅ |
| `make pilot-check` (local 🟡 / prod 🟢) | ✅ |
| `make pilot-prod-gate` (Docker PG + prod secrets) | ✅ |
| `make pilot-e2e` / CI `pilot-e2e` | ✅ |
| `make demo-smoke` | ✅ |
| `npm run build` | ✅ |

---

## Перед подключением клиента

```bash
make dev                          # local dev
make pilot-check                  # local → 🟡

# Production-like (Docker, 🟢)
make pilot-prod-gate

# Playwright smoke
make pilot-e2e

# Реальный хостинг — см. PRODUCTION_GATE.md
PILOT_API_URL=https://... PILOT_TARGET=production PILOT_LIMITATIONS_ACK=1 make pilot-check
```

Подробно: [PRODUCTION_GATE.md](./PRODUCTION_GATE.md)

1. Отправить [PILOT_SCOPE.md](./PILOT_SCOPE.md)
2. Пройти [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)
3. Invite ([MANUAL_INVITE_RUNBOOK.md](./MANUAL_INVITE_RUNBOOK.md) если нет email)

---

## Честные ограничения (не блокер пилота)

См. [SPRINT_DEFERRED_EXTERNAL.md](../dev/SPRINT_DEFERRED_EXTERNAL.md):

- Legal submit в госпорталы
- Live bank OAuth
- ERIP / оплата

---

## Основной сценарий (15 сек)

| Вопрос | Где |
|--------|-----|
| Сколько денег? | `/` BusinessHero |
| Есть проблема? | Pill риска + «Требует внимания» |
| Что делать? | WorkNowCard (1 CTA) |
| Можно сдавать отчёт? | ReportingReadiness checklist |

---

## После волны 1

См. [PILOT_BACKLOG.md](./PILOT_BACKLOG.md) — Playwright E2E в CI (опционально).
