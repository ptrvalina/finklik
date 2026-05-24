# FinClick UX Audit & Information Architecture (2026-05)

## Phase 1 — Audit summary

### Strengths (keep)
- Backend: financial state, work packs, trust surface, OCR confidence, execution feed.
- `OperationalPage` / `FocusStrip` on many screens.
- `orgQueryKey` for org-safe React Query.
- Reporting calm flow, Belarus chart corpus, scanner pipeline.

### Critical friction
| Area | Issue | Pattern to remove |
|------|--------|-------------------|
| Navigation | 5 groups + flyouts + legacy routes | ERP menu maze |
| `/accounting` | Journal only; no “Учёт” hub | Hidden sub-capabilities |
| Operations | Diagnostics/trust blocks compete with tasks | Widget soup |
| Dashboard | Metrics + AI + duplicate “what to do” | Dashboard for charts |
| Mobile bar | Bank-centric, not work-centric | Desktop shrink |
| OCR | Technical queue labels | Engineer UX |
| Routes | `/legacy/*`, `/transactions`, scattered aliases | Cognitive load |

### Dead / low-value UX
- `websites`, duplicate bank/doc paths, manager-unfriendly IA.
- Technical badges: `fallback`, pipeline status chips on Transactions.
- “Business OS” remnants (mostly fixed).

### Execution assets underused
- `top_action`, work packs, `primary_focus_hint`, document completeness → should drive **one primary CTA** per screen.
- OCR `requires_review` → task card, not stat tile.
- Reporting blockers → “осталось N шагов”, not red alert.

---

## Phase 2 — Target IA (context-first)

1. **Главная** `/` — state, obligations, cash, OCR queue, one work-now card → `/operations`.
2. **Лента работы** `/operations` — product center; execution feed only (diagnostics collapsed).
3. **Учёт** `/accounting/hub` — hub tiles; journal `/accounting/journal`; bank, scan, documents, chart, ОС.
4. **Отчётность** `/reports` — readiness-first (existing calm flow).
5. **Команда** `/employees` — HR, payroll, ФСЗН.
6. **Клиенты** `/workspace` — accountant multi-org command center.

Settings, assistant, analytics: profile menu / secondary, not primary nav.

### Mobile bottom bar
`Главная` · `Лента` · `Учёт` · `Отчёты` (+ sheet for rest).

### Principles
- Answer: где я? что важно? что дальше? всё ли ок? сколько до результата?
- No navigation-first; **task-first**.
- Calm fintech: dense, breathable, minimal glow.

---

## Implementation waves

| Wave | Scope | Status |
|------|--------|--------|
| W1 | IA nav, accounting hub, execution cards, work-now on home | Done |
| W2 | Operations execution-only; progress strip; work packs | Done |
| W3 | OCR review banner; reporting readiness hero | Done |
| W4 | Design tokens (`--fc-shadow-calm`, calm surfaces); mobile calmer shadows; thumb targets | Done |
| W5 | `CalmErrorState`, offline banner, query defaults, onboarding progress | Done |
| W6 | `/accounting/journal` alias; OperationalPage on calendar/planner/counterparties; dead FeedRow removed | Done |
