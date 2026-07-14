# Pilot Backlog — P0 / P1

**Статус P0:** ✅ закрыто (2026-07-14) — см. [PILOT_READY.md](./PILOT_READY.md)

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

**Дополнительно закрыто для pilot:**

- WorkflowContinuityBar на scan/journal/reports
- Accountant → `/workspace/queues`
- Lazy import docx (demo-smoke без полного HR stack)
- Inbox + approvals unified (`InboxQueuesPage`)

---

## P1 — после волны 1

| # | Задача | WHY | IMPACT |
|---|--------|-----|--------|
| P1-1 | ~~Inbox + approvals merge~~ | — | ✅ |
| P1-2 | ~~Accountant home queues~~ | — | ✅ redirect |
| P1-3 | ~~WorkflowContinuityBar~~ | — | ✅ Layout |
| P1-4 | Reporting % cleanup (остаток guided flow) | % в guided flow | Plain language |
| P1-5 | Taxes route | ✅ `/accounting/taxes` | — |
| P1-6 | WS `report_status` polish | Reload | Calmer UX |
| P1-7 | Playwright E2E | Regression | CI |

---

## Explicitly NOT in pilot

См. [../dev/SPRINT_DEFERRED_EXTERNAL.md](../dev/SPRINT_DEFERRED_EXTERNAL.md)

---

## Метрики

| Метрика | Источник |
|---------|----------|
| Friction | `GET /api/v1/pilot/analytics/friction` |
| Scorecard | `make pilot-check` |
