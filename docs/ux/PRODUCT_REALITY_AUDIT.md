# FinKlik — Product Reality Audit

**Дата:** 2026-06-07  
**Baseline:** `main` @ `d0894cd`  
**Рамка:** не ERP, а Financial OS — владелец понимает ситуацию за **30 секунд** после входа.  
**Ограничения аудита:** без новых разделов, сущностей, backend-модулей и расширения ERP.

---

## Сводка (30-секундный тест)

| Вопрос | Где ответ | Статус после правок |
|--------|-----------|-------------------|
| Сколько денег? | Главная (mobile hero / FinancialStateHero) | ✅ |
| Что делать сейчас? | WorkNowCard | ✅ (1 CTA) |
| Что мешает? | DashboardBlockers (операции) + ReportingReadiness (отчёты) | ✅ разделены |
| Можно сдавать отчёт? | ReportingReadiness checklist | ✅ |
| Куда дальше? | WorkflowContinuityBar: Скан→Проверка→Журнал→Отчётность→Подпись | ✅ |

**Главные проблемы до правок:** CTA-шум, дубли метрик, English в UI, тупики без следующего шага, fake UI во входящих.

---

## Аудит по экранам (7 вопросов)

Условные обозначения: **5с** = понятно за 5 секунд; **−30%** = можно урезать без потери смысла.

### Dashboard (`/`)

| # | Ответ |
|---|--------|
| 1. Задача | Утренний контроль: деньги, риск, шаг, blockers, отчётность |
| 2. 5с | ⚠️ Частично — много блоков подряд |
| 3. Лишнее | Дубль blockers; CashflowPulse в «Подробнее»; mobile hero + desktop hero |
| 4. Дубли | Blockers ↔ Readiness; WorkNow ↔ Operations top |
| 5. Тупики | FinancialStateHero `null` при ошибке API |
| 6. Без шага | Timeline empty без CTA |
| 7. −30% | ✅ Объединить blockers/readiness; скрыть timeline на mobile |

**Правки:** разделены blockers (операции) и readiness (отчёты); hero с fallback; timeline `< sm` скрыт.

---

### Operations (`/operations`)

| # | Ответ |
|---|--------|
| 1. Задача | Полная лента задач и work packs |
| 2. 5с | ❌ Нет h1; проценты и пакеты без контекста |
| 3. Лишнее | 4 KPI-плитки + ProgressStrip; diagnostics по умолчанию |
| 4. Дубли | = WorkNow + Dashboard metrics; headline 2× на mobile |
| 5. Тупики | Empty без CTA |
| 6. Без шага | Empty «стратегия» — никуда |
| 7. −30% | ✅ Убрать KPI grid; один headline; empty → главная/скан |

**Правки:** KPI grid удалён; заголовок; empty с CTA.

---

### Inbox (`/inbox`, вкладка)

| # | Ответ |
|---|--------|
| 1. Задача | Разобрать входящие запросы |
| 2. 5с | ✅ При наличии items |
| 3. Лишнее | Fake reply bubble; URGENT/NORMAL |
| 4. Дубли | Stats = Approvals pattern |
| 5. Тупики | Search no results; links only on lg |
| 6. Без шага | Mobile без «Связи» |
| 7. −30% | ✅ Убрать fake; RU tags; mobile links |

---

### Approvals (`/inbox?tab=approvals`)

| # | Ответ |
|---|--------|
| 1. Задача | Согласовать / отклонить |
| 2. 5с | ⚠️ `subject_kind` на English |
| 3. Лишнее | Stat cards в standalone (embedded — ok) |
| 4. Дубли | = Inbox stats pattern |
| 5. Тупики | Нельзя открыть предмет согласования |
| 6. Без шага | После approve — только operations hint |
| 7. −30% | ✅ RU labels; ссылка на журнал/отчёты |

**Примечание:** отдельного маршрута `/approvals` нет — redirect на inbox tab.

---

### Accounting Hub (`/accounting/hub`)

| # | Ответ |
|---|--------|
| 1. Задача | ~~Хаб учёта~~ **удалён** |
| 2–7 | Redirect → `/accounting/journal`. Дублировал dashboard — правильно убран. |

---

### Journal (`/accounting/journal`)

| # | Ответ |
|---|--------|
| 1. Задача | Провести / исправить операции |
| 2. 5с | ⚠️ Перегруз toolbar + chrome |
| 3. Лишнее | 4 stat tiles = chrome stats |
| 4. Дубли | Scan в header + continuity + capture dropzone |
| 5. Тупики | Capture form огромная |
| 6. Без шага | После post — banner ok |
| 7. −30% | ✅ Stat grid удалён; continuity bar |

---

### Bank (`/bank`)

| # | Ответ |
|---|--------|
| 1. Задача | Счета, выписки, платежи |
| 2. 5с | ⚠️ Много табов |
| 3. Лишнее | Hero + stat cards; ExecutionTopActionBanner |
| 4. Дубли | Balance 2×; import 3× |
| 5. Тупики | Manual OAuth paste |
| 6. Без шага | Empty → FocusStrip ok |
| 7. −30% | Рекомендация: убрать stat cards (не в этом проходе — scope) |

---

### Scan (`/scan`)

| # | Ответ |
|---|--------|
| 1. Задача | OCR → проверка → проводка |
| 2. 5с | ✅ Dropzone понятен |
| 3. Лишнее | Queue sidebar + mobile list |
| 4. Дубли | Readiness hero убран ранее |
| 5. Тупики | Text tab вторичен |
| 6. Без шага | Confirm → link journal ✅ |
| 7. −30% | ✅ Status line вместо KPI tiles |

---

### Documents (`/documents`)

| # | Ответ |
|---|--------|
| 1. Задача | Импорт CSV + экспорт + первичка |
| 2. 5с | ❌ Три продукта на одной странице |
| 3. Лишнее | 6 export cards; CSV import |
| 4. Дубли | Import = Bank/Journal |
| 5. Тупики | Raw status enums |
| 6. Без шага | Empty → scan/journal ok |
| 7. −30% | Рекомендация: split (future); localize badges |

---

### Counterparties (`/counterparties`)

| # | Ответ |
|---|--------|
| 1. Задача | Справочник контрагентов |
| 2. 5с | ⚠️ 7 кнопок в строке |
| 3. Лишнее | Stats + «Часто за неделю» duplicate actions |
| 4. Дубли | RowActions ×3 surfaces |
| 5. Тупики | — |
| 6. Без шага | Journal presets ok |
| 7. −30% | Рекомендация: collapse row actions |

---

### Reports (`/reports`)

| # | Ответ |
|---|--------|
| 1. Задача | Закрыть период, подать, подписать |
| 2. 5с | ✅ Headline + phase |
| 3. Лишнее | KPI % убраны ранее |
| 4. Дубли | Calendar links (сокращено) |
| 5. Tупики | Preview JSON keys |
| 6. Без шага | Guided flow ✅ |
| 7. −30% | ✅ Continuity + guided flow |

---

### Employees (`/employees/*`)

| # | Ответ |
|---|--------|
| 1. Задача | Кадры для ФСЗН/отчётности |
| 2. 5с | Hub ok; Hire ❌ |
| 3. Лишнее | Hire monolith 25+ fields |
| 4. Дубли | Два «планёра» |
| 5. Тупики | Empty hire table |
| 6. Без шага | alert() UX |
| 7. −30% | RU edit labels (quick fix) |

---

### Workspace (`/workspace`, `/workspace/queues`)

| # | Ответ |
|---|--------|
| 1. Задача | Multi-client accountant triage |
| 2. 5с | ❌ English KPI row |
| 3. Лишнее | 4+6 metric grids + FocusStrip + table |
| 4. Дубли | Inbox/OCR counts ×4 |
| 5. Тупики | No orgs empty |
| 6. Без шага | Queues empty ok |
| 7. −30% | ✅ English→RU; убран верхний KPI grid |

---

### Planner (`/planner`)

| # | Ответ |
|---|--------|
| 1. Задача | Календарь + задачи команды |
| 2. 5с | ❌ Два домена на одном scroll |
| 3. Лишнее | Productivity block |
| 4. Дубли | = employees/planner events |
| 5. Тупики | Task status raw English |
| 6. Без шaga | Empty tasks scroll to form |
| 7. −30% | RU status labels (quick fix) |

---

### Settings (`/settings`)

| # | Ответ |
|---|--------|
| 1. Задача | Профиль, интеграции, команда |
| 2. 5с | ⚠️ Admin jargon in Integrations |
| 3. Лишнее | Theme 2×; 5 summary cards |
| 4. Дубли | Profile in cards + tab |
| 5. Тупики | — |
| 6. Без шага | — |
| 7. −30% | Рекомендация: Basic/Advanced tabs |

---

## Единый сценарий (реализовано)

```
Скан → Проверка → Журнал → Отчётность → Подпись
  /scan   /scan?doc   /accounting/journal   /reports   /reports/imns
```

Компонент: `WorkflowContinuityBar` + `buildOperationalFlow`.

---

## Первые 15 минут пользователя

| Шаг | Ожидание | Риск |
|-----|----------|------|
| Регистрация / login | Понятный вход | ✅ |
| Business profile | Не блокирует nav | Banner on home |
| Главная | 4 ответа за 30с | ✅ после правок |
| Первый документ | Scan → verify → journal | Continuity bar |
| Банк | Подключить счёт | Empty FocusStrip |
| Отчёт | Checklist not % | ✅ |

---

## Пустые состояния и ошибки

| Экран | Empty | Error |
|-------|-------|-------|
| Dashboard | Per-block | CalmErrorState page |
| Operations | + CTA главная/скан | CalmErrorState |
| Inbox | Scan/Journal | Retry |
| Approvals | Operations link | Retry |
| Journal | Add operation | Table skeleton |
| FinancialStateHero | — | Fallback card (added) |

---

## Mobile UX

| Экран | Fix |
|-------|-----|
| `/` | Hero money + WorkNow above fold; timeline hidden |
| Inbox | Context links on mobile |
| InboxQueues | Full-width tabs; «Все задачи» visible |
| Operations | No duplicate fixed headline |
| Reports | Sticky submit preserved |

---

## Что сознательно не трогали (scope)

- Documents page split / Bank stat dedupe / Counterparties row collapse
- Settings Integrations Basic/Advanced
- Planner tab split
- Hire wizard

Эти пункты — следующий проход без новых сущностей, только UX-surgery.

---

*Implementations in commit following this audit: dashboard dedupe, operations slim, inbox/approvals RU, journal stat cut, workspace RU KPI, 5-step continuity flow.*

---

## Fintech maturity pass (Mercury / Revolut Business / Xero)

**Дата:** 2026-06-07 · **Commit:** после `7541e55`  
**Цель:** за 5 секунд — где я, сколько денег, есть ли риск, что делать дальше.

### Навигация

| Проблема | Влияние | Решение | Эффект |
|----------|---------|---------|--------|
| Sidebar (зоны) + header tabs (подразделы) | Два меню с одними маршрутами | Убрать header/mobile tabs; подразделы — в sidebar под активной зоной | Одна mental model |
| «Сегодня» vs «Главная» | Не совпадает с fintech IA | 6 зон: Главная, Деньги, Отчётность, Команда, Клиенты, Настройки | Мгновенная ориентация |
| Слабый active state | Непонятно где пользователь | Левая полоса + контрастный фон + filled icon | − ошибок навигации |

### Header

| Проблема | Влияние | Решение | Эффект |
|----------|---------|---------|--------|
| Новая операция, Поток учёта, Онлайн, тема | Конкурируют с контентом | Оставить поиск, уведомления, профиль; тема → Настройки | Фокус на работе |
| Широкий поиск | Выглядит как главный элемент | −30% ширины/высоты, ghost-стиль | Контент важнее chrome |

### Dashboard (Business Control Center)

| Проблема | Влияние | Решение | Эффект |
|----------|---------|---------|--------|
| Mobile hero + desktop hero | Дубль «деньги» | Один FinancialStateHero на всех breakpoints | Q1 везде одинаково |
| Hero primary + WorkNow primary | 2+ primary CTA | Hero без primary; WorkNow — единственная primary | Один следующий шаг |
| «Ситуация под контролем» без цифр | Абстракция | Сначала остаток, поток, налог, риск; интерпретация после | Доверие к цифрам |
| «Ничего не блокирует» — целая карточка | Пустой шум | Компактная строка «Рисков нет ✓» | − вертикаль |
| % готовности отчётности | Непонятно что делать | Чеклист: документы → журнал → проверки → подпись → отправка | Action-first |
| Крупные glass-card, space-y-6 | Лендинг, не tool | p-4, space-y-4, компактные секции | + плотность |

### Accounting flow rail

| Проблема | Влияние | Решение | Эффект |
|----------|---------|---------|--------|
| OperationalContinuityPanel всегда справа | Отвлекает вне процесса | Rail только на scan/journal/reports | Workflow in context |

### Локализация и валюта

| Проблема | Влияние | Решение | Эффект |
|----------|---------|---------|--------|
| «Operating System» в sidebar | English jargon | «Финансы и учёт» | Понятно ИП |
| Разрозненный fmt + BYN | Несогласованность | `lib/formatMoney.ts` | Единый BYN |
