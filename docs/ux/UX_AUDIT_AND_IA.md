# FinClick UX Audit & Information Architecture (2026-05)

## Phase 1 — Audit summary

### Strengths (keep)
- Backend: financial state, work packs, trust surface, OCR confidence, execution feed.
- `OperationalPage` / `FocusStrip` on core screens.
- `orgQueryKey` for org-safe React Query.
- Reporting calm flow, Belarus chart corpus, scanner pipeline.

### Resolved friction (2026-05 waves W1–W7)
| Area | Was | Now |
|------|-----|-----|
| Navigation | ERP maze | Context-first groups + mobile bar |
| Учёт | Journal hidden | Hub `/accounting/hub`, journal `/accounting/journal` |
| Operations | Widget soup | Execution feed + diagnostics toggle → `/admin/ops` |
| Dashboard | Chart-first | WorkNow + focus strip + collapsible details |
| Documents | `/legacy/documents` | `/documents` |
| OCR queue | Metric tile | `OcrQueueCard` + focus strip |
| Reporting | Duplicate calm UI | `ReportingReadinessHero` + guided flow |

### Optional / backlog
- Bulk actions in journal (массовое проведение).
- Расширить i18n на редкие admin-экраны.

---

## Target IA (context-first)

1. **Главная** `/` — work-now, focus strip, onboarding; details collapsed.
2. **Лента работы** `/operations` — execution center.
3. **Учёт** `/accounting/hub` — tiles; **журнал** `/accounting/journal`.
4. **Документы** `/documents` — первичка и импорт.
5. **Отчётность** `/reports` — readiness hero, guided flow.
6. **Команда** `/employees` — HR hub.
7. **Клиенты** `/workspace` — accountant command center.

Mobile bar: `Главная` · `Лента` · `Учёт` · `Отчёты`.

---

## Implementation waves

| Wave | Scope | Status |
|------|--------|--------|
| W1 | IA nav, accounting hub, execution cards, work-now | Done |
| W2 | Operations execution-only; progress strip; work packs | Done |
| W3 | OCR review banner; reporting readiness hero | Done |
| W4 | Design tokens; mobile calm shadows; thumb targets | Done |
| W5 | CalmErrorState; offline banner; onboarding progress | Done |
| W6 | `/accounting/journal`; calendar/planner/counterparties shells | Done |
| W7 | Dashboard simplify; documents route; reporting steps; execution banners; debt cleanup | Done |
| W8 | Journal hotkeys (I/E//G/D/?); RU pipeline labels; hotkeys help | Done |
