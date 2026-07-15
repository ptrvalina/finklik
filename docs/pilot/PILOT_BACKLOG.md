# Pilot Backlog — P0 / P1

**Статус:** ✅ Pilot-ready (код + gate + E2E) — 2026-07-15  
См. [PILOT_READY.md](./PILOT_READY.md) · [PRODUCTION_GATE.md](./PRODUCTION_GATE.md)

---

## P0 — закрыто

| # | Задача | Статус |
|---|--------|--------|
| P0-1 … P0-6 | Product logic, nav, scope, copy | ✅ |

---

## P1 — закрыто

| # | Задача | Статус |
|---|--------|--------|
| P1-1 … P1-7 | Inbox, queues, workflow bar, % cleanup, hub | ✅ |
| P1-E2E | Playwright `e2e/pilot-smoke.spec.ts` + CI job | ✅ |
| P1-PROD | `docker-compose.pilot.yml` + `make pilot-prod-gate` | ✅ |

---

## Ops (на стороне деплоя)

| # | Задача | Команда |
|---|--------|---------|
| OPS-1 | 🟢 на реальном API | [PRODUCTION_GATE.md](./PRODUCTION_GATE.md) вариант B |
| OPS-2 | Реальный EMAIL провайдер | Resend/SendGrid в secrets |
| OPS-3 | Live bank OAuth | post-pilot (deferred) |

---

## Explicitly NOT in pilot

См. [../dev/SPRINT_DEFERRED_EXTERNAL.md](../dev/SPRINT_DEFERRED_EXTERNAL.md)
