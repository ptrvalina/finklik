# Pilot Backlog — P0 / P1

**Статус:** ✅ Pilot-ready (код) — 2026-07-15  
См. [PILOT_READY.md](./PILOT_READY.md)

---

## P0 — закрыто

| # | Задача | Статус |
|---|--------|--------|
| P0-1 | Главная: hero + WorkNow + readiness + blockers | ✅ |
| P0-2 | Control redirect → `/` | ✅ |
| P0-3 | `/accounting` → journal | ✅ |
| P0-4 | pilot-check gate (prod: PG + secrets) | ✅ |
| P0-5 | MANUAL_INVITE_RUNBOOK | ✅ |
| P0-6 | Copy без jargon, checklist вместо % | ✅ |

**Дополнительно:**

- WorkflowContinuityBar на scan/journal/reports
- Accountant → `/workspace/queues`
- Lazy import docx (demo-smoke)
- Inbox + approvals unified (`InboxQueuesPage`)

---

## P1 — закрыто (код)

| # | Задача | Статус |
|---|--------|--------|
| P1-1 | Inbox + approvals merge | ✅ |
| P1-2 | Accountant home → queues | ✅ |
| P1-3 | WorkflowContinuityBar | ✅ |
| P1-4 | Reporting % cleanup (guided flow + workspace) | ✅ checklist |
| P1-5 | Taxes route `/accounting/taxes` | ✅ |
| P1-6 | WS `report_status` → toast + invalidate reporting | ✅ |
| P1-7 | Hub orphan removed | ✅ deleted `Hub.tsx` |

---

## P1 — отложено (не блокер пилота)

| # | Задача | WHY |
|---|--------|-----|
| P1-E2E | Playwright smoke в CI | Регрессия; нужен auth fixture + `make dev` в CI |

---

## Explicitly NOT in pilot

См. [../dev/SPRINT_DEFERRED_EXTERNAL.md](../dev/SPRINT_DEFERRED_EXTERNAL.md)

---

## Метрики

| Метрика | Источник |
|---------|----------|
| Friction | `GET /api/v1/pilot/analytics/friction` |
| Scorecard | `make pilot-check` |
