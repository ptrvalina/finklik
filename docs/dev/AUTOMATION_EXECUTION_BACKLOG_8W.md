# FinKlik Automation Backlog (8 Weeks)

Цель: довести продукт до режима "exception-first", где пользователь обрабатывает только исключения, а рутинные шаги выполняются автоматически.

## Sprint 1 (Week 1) - Stable Accounting Core

- [x] Unified pipeline statuses for operations: `new -> parsed -> categorized -> verified -> reported`
- [x] Mandatory validation checks before autosteps
- [x] Operation UI updated with pipeline badges and validation hints
- [x] UX cleanup in `Bank`, `Documents`, `Reporting` (remaining polish)
- [x] KPI instrumentation: pipeline pass rate target >= 95%

## Sprint 2 (Week 2) - Auto-categorization Rules

- [x] Rule engine for categorization by counterparty, description patterns, amount/VAT templates
- [x] Auto-detect standard flows (rent, payroll, taxes, bank fees)
- [x] Rule management screen for owner/accountant
- [x] KPI tracking: auto-categorized share target >= 60%

## Sprint 3 (Week 3) - OCR to Accounting

- [x] Scanner pipeline confidence scoring
- [x] Duplicate detection for scanned docs
- [x] Auto-link document to transaction/bank line
- [x] Manual queue only for low-confidence documents
- [x] KPI tracking: OCR without manual correction target >= 70%

## Sprint 4 (Week 4) - Auto Taxes and Obligation Calendar

- [x] Automatic tax/contribution recalculation from ledger changes
- [x] Obligation calendar with auto-tasks and reminders
- [x] Guardrails for unsafe actions on inconsistent data
- [x] KPI tracking: obligations auto-created target = 100%

## Sprint 5 (Week 5) - Auto Reporting and Submission Adapter

- [x] Automatic package assembly + pre-validation
- [x] Scheduled auto-submit mode with readiness checks
- [x] Retry strategy and fallback to "manual review required"
- [x] KPI tracking: report readiness without manual edits target >= 80%

## Sprint 6 (Week 6) - Payroll and Workforce Loop

- [x] End-to-end HR flow: hire/terminate -> calc -> forms -> submit
- [x] Auto planner events on workforce changes
- [x] Unified payroll/reporting error registry with priority
- [x] KPI tracking: payroll auto-calculation target >= 90%

## Sprint 7 (Week 7) - Automation Orchestrator

- [x] Automation center: scenarios, schedules, conditions, limits
- [x] Modes: `Assist`, `Auto with checkpoints`, `Autopilot`
- [x] Policy engine for full-auto permissions
- [x] KPI tracking: >= 3 E2E scheduled scenarios

## Sprint 8 (Week 8) - Reliability, Audit, Scale

- [x] Full audit log: who/what/when/why
- [x] SLA metrics, alerts, and operational health dashboard
- [x] Load tests + hardening of critical queues
- [x] KPI tracking: auto job success > 98%, recurring incidents < 2%/week

## Parallel Weekly Track

- [x] Unit + integration + 3-5 critical E2E scenarios
- [x] Metrics on each pipeline step
- [x] Data quality controls (deduplication and consistency checks)
- [x] UX rule: one manual-review screen max, all else automatic

## Product End-State KPI

- [x] >= 85% operations processed end-to-end automatically
- [x] >= 70% OCR docs without manual input
- [x] >= 80% reports auto-generated without manual edits
- [x] >= 90% payroll cases without manual intervention
- [x] >= 3x reduction in "operation -> report ready" cycle time
