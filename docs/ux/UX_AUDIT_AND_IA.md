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
- Расширить i18n на редкие admin-экраны.

---

## Target IA (NOW / MONEY / REPORTING / TEAM / CONTROL)

| Группа | Маршруты |
|--------|----------|
| **Сейчас** | `/` · `/operations` · `/inbox` · `/approvals` |
| **Деньги** | `/accounting/hub` (+ журнал, банк, документы, контрагенты, план, ОС, скан) |
| **Отчётность** | `/reports` · `/calendar` · `/employees` (ФСЗН) |
| **Команда** | `/workspace` (бухгалтер) · `/planner` · `/employees` |
| **Контроль** | `/control/state` · `/control/trust` · `/analytics` · `/settings` |

**Финансовое состояние** — `FinancialStateHero` на главной и в ленте; полная страница `/control/state`.

Mobile bar: `Главная` · `Лента` · `Входящие` · `Учёт`.

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
| P1 | IA NOW/MONEY/REPORTING/TEAM/CONTROL; FinancialStateHero; inbox/approvals; control pages | Done |
| P2 | Feed: why / if ignored / confidence; type-specific risk copy | Done |
| P4 | `/workspace/accountant/queues`; global queues UI; recent clients; pin on cards | Done |
| P3 | OCR corrections API; autosave; keyboard flow; vendor memory on edit; review queue load | Done |
| P3b | Batch upload (20); journal deep-link `tx_id`; preprocess doc_hint; calmer scanner stats | Done |
| P5a | Pilot: onboarding «лента работы»; пустые inbox/approvals с CTA; copy регистрации | Done |
| P5b | Inbox/approvals: PATCH actions (роль accountant/admin); journal deep-link из inbox | Done |
| P5c | OCR: авто-переход по очереди проверки + «Следующий в очереди» | Done |
| P5d | Work packs: `progress_pct`, `blocked_reason`, `acknowledged` из ленты + domain_events | Done |
| P5e | Journal: `POST /transactions/bulk-post`; bulk bar «Провести» | Done |
| F1 | Operational session (sessionStorage) + continuity panel + smart next step | Done |
| F1b | Unified action verbs; grouped execution feed order | Done |
| F2 | Work packs: `tasks_done`/`tasks_total`, honest `progress_pct`, `eta_minutes` | Done |
| F3 | OCR: deskew/EXIF preprocess, field_regions overlay, KUDiР/платёжки, vendor memory loop | Done |
| F5a | Pilot: queue mode copy, mobile journal bulk, RU labels (диагностика, премиум) | Done |
| F3c | OCR: projection deskew; KUDiР суммы; подсказки Дт/Кт на сканере | Done |
| F5b | План №50 meta в API/UI; RU настройки/логин/банк; терминология учёта | Done |
| F4a | Операционные заметки: inbox / согласования / пакеты работ (`/workspace/comments`) | Done |
| F4b | OrgSwitcher → recent clients; вкладка общих очередей в sessionStorage | Done |
| F5c | Пилот: пустой дашборд → сканер + журнал | Done |
| F1c | Поток учёта: лестница Скан→Журнал→Отчётность; `doc_id` на сканере; bulk→/reports | Done |
| F5d | RU баннер уведомлений; мобильная панель действий в отправках | Done |
| F5e | RU: автопилот, 1С endpoint, контрагенты «слой связей» | Done |
| TD1 | `scannerUiSession` — авто-очередь OCR per org; `reportingFlowSession` per org | Done |
| TD2 | Гид отчётности: sticky actions mobile; RU сканер/документы (вебхук, умный захват) | Done |
| TD3 | RU: типы документов, аналитика KPI, 1С retry; `documentTypeLabels`; тест bulk-post | Done |
| P4 | Hub учёта: FinancialState + приоритеты очередей; shortcuts; не плиточный ERP | Done |
| P5a | Journal + Scanner: compact FinancialStateHero | Done |
| P5 | Journal: split panel, hotkeys, bulk, inline post, mobile virtual list, issues highlight | Done |
| P5b | JournalWorkspaceChrome; panelTxId session; P=провести; calm capture; −дубли FocusStrip | Done |
| OS | Полный audit + phased plan: `docs/ux/FINANCIAL_OS_UX_AUDIT_2026-05.md` | Done |
| P5 | Journal: split-view desktop, замечания API, провести inline, хронология, visual diet | Done |
| P6 | Workspace mission control: сроки, OCR по клиентам, сводные приоритеты (`/workspace`) | Done |
| P7 | Отчётность: нарратив периода, подписи шагов гида, focus strip из calm | Done |
