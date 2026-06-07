# FinKlik — Product Logic Audit & IA Refactor Plan

**Дата:** 2026-06-07  
**Статус:** Фазы 1–7 реализованы в коде (2026-06-07)  
**Baseline:** `main` @ `3fcf8cf` → UX IA refactor branch  
**Продуктовая рамка:** FinKlik — **Financial Operating System** для малого бизнеса Беларуси, не «бухгалтерская программа».

### Executive summary

| Метрика | Значение |
|---------|----------|
| Canonical routes (без redirects) | **38** |
| Redirect-only routes | **14** |
| Зон в sidebar сейчас | **5** (включая **Контроль** — под удаление) |
| Экранов с дублем `FinancialStateHero` | **7+** |
| Экранов, проходящих 15s test | **1 частично** (`/` перегружена) |
| Удалить из nav (рекомендация) | Control, hub, state, trust, analytics, notes |

**Вердикт:** backend готов (state / feed / work packs); IA всё ещё ERP-структура. Refactor = навигация + главная + слияние дублей, без новых страниц.

---

## 1. Цель продукта (15-секундный тест)

После входа владелец бизнеса должен получить ответы на **4 вопроса**:

| # | Вопрос | Единственный источник правды (целевой) |
|---|--------|----------------------------------------|
| Q1 | **Сколько денег у меня есть?** | Блок **Financial State Hero** на главной → детали в **Банк** / **Журнал** |
| Q2 | **Что требует внимания сейчас?** | Блок **Work Now** на главной → исполнение в **Лента** / **Сканер** / **Входящие** |
| Q3 | **Есть ли риск?** | Статус в **Financial State Hero** (зелёный / жёлтый / красный) — не отдельный раздел |
| Q4 | **Можно ли сдавать отчётность?** | Блок **Reporting Readiness** на главной → **Отчётность** (чеклист действий, не %) |

**Правило:** если экран не помогает ответить ни на один вопрос — он **второстепенный** (Настройки, deep admin) или **подлежит слиянию/удалению**.

---

## 2. Диагностика текущего состояния

### 2.1. Главные проблемы

| Проблема | Где проявляется | Когнитивная нагрузка |
|----------|-----------------|---------------------|
| **Дублирование «состояния»** | `/`, `/operations`, `/control/state`, `/accounting/hub` — везде `FinancialStateHero`, KPI OCR, готовность % | Пользователь не знает, куда смотреть «истину» |
| **Зона «Контроль» как продукт** | `/control/state`, `/control/trust`, `/analytics` в sidebar | Ощущение ERP-модуля, не бизнес-языка |
| **Hub учёта = ещё один dashboard** | `/accounting/hub` — KPI + shortcuts + hero | Лишний экран между «Деньги» и работой |
| **Проценты вместо действий** | Hub, Financial State, Analytics — «готовность 84%» | Не понятно *что сделать* |
| **Разрыв workflow** | Сканер → Журнал → Отчётность — три «подсистемы» с разной IA | Нет ощущения одного потока |
| **Product jargon** | Business OS, Trust Surface, Operational Confidence, Reliability Index | Непонятно предпринимателю |
| **Hero на каждом экране** | `FinancialStateHero` на journal, scan, hub, operations, state | Каждый экран = «мини-главная»; нет единого центра |
| **Главная перегружена** | Dashboard: hero + readiness + timeline + WorkNow + focus strip + onboarding + briefing + journey + AI + charts | >15 секунд на понимание |
| **Сотрудники в двух зонах** | Flyout «Отчётность» и зона «Команда» | Дублирование IA |

### 2.2. Что уже хорошо (сохранить в refactor)

- Backend: financial state bundle, execution feed, work packs, OCR pipeline, inbox/approvals, reporting calm flow.
- Компоненты: `FinancialStateHero`, `ReportingReadinessHero`, `WorkNowCard`, `DashboardTimeline`, `OperationalContext` (next step).
- Workspace бухгалтера: `/workspace`, `/workspace/queues` — задел под TaxDome/Karbon-модель очередей.
- Guided reporting flow и чеклисты блокеров (нужно поднять на главную, убрать %).

---

## 3. Полный аудит маршрутов

Условные обозначения:

- **4Q:** отвечает на Q1–Q4 (деньги / внимание / риск / отчётность).
- **Merge?** — можно объединить с другим маршрутом.
- **Delete?** — убрать как самостоятельный пункт навигации (маршрут может остаться как redirect или deep link).

### 3.1. Публичные и онбординг

| Route | Purpose | User Decision | Primary CTA | Can Merge? | Can Delete? |
|-------|---------|---------------|-------------|------------|-------------|
| `/login` | Вход в систему | «Это мой аккаунт?» | Войти | — | Нет |
| `/register` | Создание аккаунта | «Начать пользоваться?» | Зарегистрироваться | С `/login` (tabs) | Нет |
| `/accept-invite` | Принятие приглашения в организацию | «Присоединиться к команде?» | Принять | — | Нет |
| `/onboarding/business-profile` | Профиль бизнеса (режим, реквизиты) | «Достаточно ли данных для учёта?» | Сохранить и продолжить | В **Настройки → Профиль** после первого входа | Нет (но не sidebar) |

### 3.2. СЕЙЧАС (целевая зона)

| Route | Purpose | User Decision | Primary CTA | 4Q | Can Merge? | Can Delete? |
|-------|---------|---------------|-------------|-----|------------|-------------|
| `/` | Сводка бизнеса | «Всё хорошо или есть проблема? Что делать?» | Work Now action | Q1–Q4 | **Центр продукта** — не merge | Нет |
| `/operations` | Лента исполнения, work packs | «Что в очереди и в каком порядке?» | Открыть top task | Q2, Q3 | **Частично в `/`** — лента = drill-down из Work Now / Blockers | **Из nav:** да (остаётся deep link) |
| `/inbox` | Входящие запросы по организации | «Что от меня ждут?» | Взять в работу / закрыть | Q2 | С **Согласования** → единая «Очередь» (вкладки) | **Из nav:** merge с approvals |
| `/approvals` | Согласования расходов/отчётов | «Подтвердить или отклонить?» | Согласовать | Q2, Q3 | С **Входящие** | **Из nav:** merge с inbox |

### 3.3. ДЕНЬГИ (целевая зона)

| Route | Purpose | User Decision | Primary CTA | 4Q | Can Merge? | Can Delete? |
|-------|---------|---------------|-------------|-----|------------|-------------|
| `/accounting/hub` | Хаб учёта: shortcuts + дубль state | «Куда идти в учёте?» | Журнал / Сканер | Q1, Q2 (дубль) | **Удалить landing** — таб «Журнал» = default зоны | **Да (как экран)** |
| `/accounting/journal` | Журнал операций | «Провести / исправить / связать документ?» | Провести / редактировать | Q1 | — | Нет |
| `/scan` | OCR: загрузка и проверка | «Документ верно распознан?» | Подтвердить → журнал | Q2, Q4 | Workflow step, не «модуль» | Нет (но не отдельная «подсистема» в copy) |
| `/bank` | Счета, выписки, платежи | «Сколько на счетах / импорт выписки?» | Импорт / перевод | Q1 | — | Нет |
| `/bank/oauth/callback` | OAuth банка | Технический | — | — | — | Нет (скрытый) |
| `/documents` | Архив документов | «Найти первичку?» | Открыть / привязать | Q4 | С журналом (side panel) | **Из nav:** опционально (secondary) |
| `/counterparties` | Контрагенты | «Кому платим / от кого получаем?» | Создать / открыть | — | С журналом (filter) | **Из nav:** secondary |
| `/accounting/chart` | План счетов | «Какой счёт использовать?» | Выбрать счёт | — | **Настройки → Учёт** | **Да (из nav)** |
| `/accounting/fixed-assets` | Основные средства | «Какие ОС на балансе?» | Добавить ОС | — | — | Нет (редкий, но valid) |
| `/accounting` | Redirect → journal | Совместимость | — | — | — | Redirect OK |

### 3.4. ОТЧЁТНОСТЬ (целевая зона)

| Route | Purpose | User Decision | Primary CTA | 4Q | Can Merge? | Can Delete? |
|-------|---------|---------------|-------------|-----|------------|-------------|
| `/reports` | Готовность и подача отчётов | «Можно подавать? Куда?» | Чеклист → подать | Q4 | **Готовность** = блок на `/`, не отдельный пункт | Нет (hub отчётности) |
| `/reports/:authority` | Подача в ИМНС/ФСЗН/… | «Отправить в конкретный орган?» | Подписать / отправить | Q4 | Под `/reports` | Нет |
| `/calendar` | Налоговый календарь | «Когда следующий срок?» | Открыть обязательство | Q3, Q4 | В **Отчётность** (tab) | **Из nav:** tab only |
| `/employees` | Кадры и ФСЗН (hub) | «Штат в порядке для отчётов?» | Табель / приём | Q4 | **Команда** (не отчётность flyout) | Нет |
| `/employees/hire` | Приём сотрудника | Оформить приём | Сохранить | — | Под `/employees` | Нет (nested) |
| `/employees/dismiss` | Увольнение | Оформить увольнение | Сохранить | — | Под `/employees` | Нет |
| `/employees/timesheet` | Табель | Закрыть месяц | Провести табель | Q4 | — | Нет |
| `/employees/staffing` | Штатное расписание | Проверить ставки | — | — | — | Нет |
| `/employees/planner` | HR-планёр | Запланировать кадровое | — | — | С **Планёр** команды | Merge optional |

### 3.5. КОМАНДА (целевая зона)

| Route | Purpose | User Decision | Primary CTA | 4Q | Can Merge? | Can Delete? |
|-------|---------|---------------|-------------|-----|------------|-------------|
| `/planner` | Задачи и поручения | «Что запланировано?» | Создать задачу | Q2 | — | Нет |
| `/workspace` | Бухгалтер: клиенты | «У какого клиента горит?» | Переключить org | Q2, Q3 | **Главная бухгалтера** (role-based `/`) | Нет (role) |
| `/workspace/queues` | Очереди по всем клиентам | «Что обработать первым?» | Открыть клиента → inbox | Q2 | С `/workspace` (tabs) | **Из nav:** merge |

### 3.6. УДАЛЯЕМЫЕ КАК РАЗДЕЛЫ (→ Главная / Настройки)

| Route | Purpose сейчас | User Decision | Primary CTA | 4Q | Can Merge? | Can Delete? |
|-------|----------------|---------------|-------------|-----|------------|-------------|
| `/control/state` | Financial State page | «Каково состояние?» | Лента / Trust | Q1–Q3 | **→ `/` блок 1** | **Да (nav + route → redirect `/`)** |
| `/control/trust` | Trust / jobs / confidence | «Можно ли доверять данным?» | Лента | Q3 | **→ `/` blockers + Settings → Диагностика** | **Да** |
| `/analytics` | BI: графики, KPI автоматизации | «Как шли доходы?» | Журнал | Q1 (historical) | **Свернуть в главную** (collapsible) или Settings | **Да (из nav)** |
| `/assistant` | ИИ-консультант | «Спросить как сделать» | Отправить вопрос | — | **Настройки / floating** | **Из nav:** да |

### 3.7. НАСТРОЙКИ и admin

| Route | Purpose | User Decision | Primary CTA | 4Q | Can Merge? | Can Delete? |
|-------|---------|---------------|-------------|-----|------------|-------------|
| `/settings` | Организация, интеграции, 1С, Telegram | «Как подключено?» | Сохранить | — | **Единственный «всё остальное»** | Нет |
| `/admin/ops` | Ops diagnostics (admin) | Технический health | — | — | Settings (admin tab) | **Из nav:** да |
| `/notes` | Личные заметки | «Записать мысль» | Сохранить | — | Planner или убрать | **Да (orphan)** |

### 3.8. Redirects и legacy (не пункты IA)

| Route | Назначение | Delete route? |
|-------|------------|---------------|
| `/transactions` | → `/accounting/journal` | Keep redirect |
| `/taxes` | → `/bank` | Keep redirect (TaxesPage orphan) |
| `/currency` | → `/bank` | Keep redirect |
| `/scanner` | → `/scan` | Keep redirect |
| `/reporting`, `/reporting/:authority` | → `/reports` | Keep redirect |
| `/websites` | → `/settings` | Keep redirect |
| `/onec-contour`, `/onec-sync` | → `/settings` | Keep redirect |
| `/legacy/*` | Совместимость | Keep redirect |

### 3.9. Файлы без маршрута (технический долг)

| File | Статус |
|------|--------|
| `TaxesPage.tsx` | Не в router (redirect `/taxes` → bank) — **удалить или встроить в bank/reports** |
| `TransactionsPage.tsx` | Redirect — **удалить файл** |
| `OnecContourPage.tsx`, `OnecSyncPage.tsx` | В settings embed — OK |
| `EmployeesPage.tsx` | Дубликат — проверить и удалить |
| `CounterpartiesPage.tsx` vs `Counterparties.tsx` | Дубликат — консolidate |
| `Scan.tsx` | Legacy — удалить если unused |

---

## 4. Матрица дублирования (один источник правды)

| Данные | Сейчас показывается в | Целевой источник | Действие |
|--------|----------------------|------------------|----------|
| Остаток на счетах | `/`, `/bank`, `FinancialStateHero` | **`useFinancialSnapshot()` → Home hero** | Bank = детали, убрать KPI duplicate |
| OCR в очереди | `/`, hub, operations, state | **Home Blockers + Scan queue** | Убрать KPI с hub/state |
| Готовность отчётности % | `/`, hub, state, reports, analytics | **Home Reporting Readiness (actions)** | Убрать % из hub/state |
| Risk level | `/`, operations, `/control/state` | **Home hero status pill** | Delete `/control/state` |
| Trust / background jobs | `/control/trust`, operations diag | **Home timeline + Settings** | Delete `/control/trust` |
| Work Now / top task | `/`, operations, inbox | **`OperationalContext.nextStep`** | Operations = list view only |
| Execution feed | `/operations` only | Operations + push notification to Home | Home shows **one** task |
| Business profile incomplete | Dashboard focus strip | Onboarding on Home (conditional) | OK |

---

## 5. Целевая IA (5 зон)

```
СЕГОДНЯ          ДЕНЬГИ              ОТЧЁТНОСТЬ           КОМАНДА           НАСТРОЙКИ
────────         ───────              ───────────          ───────           ─────────
Главная          Журнал               Готовность*          Сотрудники        Профиль
Лента работы†    Банк                 Отчёты               Клиенты‡          Интеграции
Входящие‡        Документы            Календарь            Планёр            1С / Банк API
Согласования‡    Контрагенты†         (ФСЗН → employees)   (Очереди‡)        Консультант†
                 ОС
                 Сканер†

* «Готовность» — якорь на `/reports#readiness`, не отдельная страница
† secondary tab или deep link, не в sidebar level-1
‡ бухгалтер: «Клиенты» + «Очереди»; owner: inbox+approvals merged optional
```

### 5.1. Role-based entry

| Роль | После login | Mobile bar |
|------|-------------|------------|
| **owner** | `/` Business Control Center | Главная · Деньги · Отчётность · Ещё |
| **accountant** | `/workspace/queues` или unified queues home | Очереди · Клиенты · Скан · Ещё |
| **manager** | `/scan` или `/planner` | Скан · Задачи · Входящие |

### 5.2. Сравнение: было → будет

| Было (navConfig) | Станет |
|------------------|--------|
| 5 зон incl. **Контроль** | 5 зон: **Сегодня · Деньги · Отчётность · Команда · Настройки** |
| `/accounting/hub` default money | `/accounting/journal` default money |
| `/control/state`, `/control/trust` | Redirect → `/` |
| `/analytics` in Control | Collapse → Home details или Settings → Аналитика |
| `/assistant` in Control tabs | Settings или FAB |
| Employees in Reporting flyout | Только **Команда** |

---

## 6. Карта удаляемых / объединяемых экранов

### 6.1. Удалить из навигации (маршрут → redirect)

| Экран | WHY | WHAT | IMPACT |
|-------|-----|------|--------|
| **Контроль** (zone) | Отдельный «модуль контроля» не отвечает на бизнес-вопрос | Зона убрана; state/trust/analytics не в sidebar | Пользователь не ищет «финансовое состояние» — видит на главной |
| **`/control/state`** | Дубль Financial State Hero + KPI | 301 → `/`; данные только в Home Block 1 | −1 экран, −4 KPI duplicate |
| **`/control/trust`** | Jargon «Trust Surface»; jobs — admin concern | Blockers на Home; jobs в Settings | Предприниматель видит «что мешает», не «operational confidence» |
| **`/accounting/hub`** | Лишний hop; ERP hub | Default `/accounting/journal`; hub redirect | −1 клик до работы |
| **`/analytics`** (top-level) | Второстепенно для 15s test | Collapsible на Home или Settings tab | Фокус на решениях, не графиках |
| **`/assistant`** (top-level) | Не daily decision | FAB / Settings | Nav про бизнес, не про чат |
| **`/notes`** | Orphan, не в IA | Удалить route или merge Planner | Меньше шума |

### 6.2. Объединить

| A + B | WHY | WHAT | IMPACT |
|-------|-----|------|--------|
| **Inbox + Approvals** | Оба — «что ждёт решения» | `/inbox` с tabs: Запросы · Согласования | Один экран «Очередь решений» |
| **Workspace + Queues** | Два entry для бухгалтера | `/workspace` с tabs: Клиенты · Очереди · Сроки | TaxDome-style single desk |
| **Operations → Home drill-down** | Две «главные» для attention | Home = 1 task; «Все задачи» → `/operations` | Work Now не конкурирует с лентой |
| **Scan в workflow** | OCR как «модуль» | Stepper: Документ → Проверка → Проводка (banner continuity) | Один процесс без смены «системы» |
| **Reporting readiness** | % на 4 экранах | Единый `ReportingReadinessPanel` только Home + Reports | Чеклист «осталось сделать» |

### 6.3. Оставить без изменения маршрута (только UX/copy)

| Экран | Примечание |
|-------|------------|
| `/accounting/journal` | Core money work |
| `/bank` | Source of cash truth (details) |
| `/reports` | Submission + guided flow |
| `/scan` | OCR step (workflow chrome) |
| `/settings` | All admin/config |
| `/employees/*` | HR compliance |
| `/planner` | Team coordination |
| `/admin/ops` | Admin-only, hidden |

---

## 7. Спецификация новой Главной (Business Control Center)

> Не dashboard. Не ERP. **5 блоков сверху вниз.** Всё остальное — за «Подробнее» или в зонах.

### Блок 1 — FINANCIAL STATE HERO

**WHY:** Сейчас hero + KPI strip + focus strip = три ответа на «сколько денег».  
**WHAT:** Один hero: деньги · прибыль (мес.) · ликвидность (дней) · статус отчётности · **риск (OK / Внимание / Срочно)**.  
**IMPACT:** За 3 сек — «всё хорошо» или «есть проблема».

```
┌─────────────────────────────────────────────┐
│  12 450 BYN на счетах    [Всё под контролем] │
│  +2 100 прибыль · 45 дн. ликвидность         │
│  Отчётность: можно подавать после 2 шагов    │
└─────────────────────────────────────────────┘
```

**API:** `operationsApi.financialState()` + `bankApi.getBalance()` — **один hook**, не 3 query на странице.

### Блок 2 — WORK NOW

**WHY:** WorkNowCard + Operations feed + FocusStrip = три «следующих шага».  
**WHAT:** **Ровно одна** карточка из `OperationalContext.nextStep` / execution feed top-1.  
**IMPACT:** Нет паралича выбора.

### Блок 3 — BLOCKERS

**WHY:** Blockers размазаны по OCR KPI, trust, inbox counts.  
**WHAT:** Список 3–5 препятствий plain language: «Проверить чек АЗС», «Не согласован расход 120 BYN».  
**IMPACT:** Понятно *что мешает*, не «pending_ocr: 3».

### Блок 4 — REPORTING READINESS

**WHY:** «84% готовности» не actionable.  
**WHAT:** Чеклист с ✓/○ и финальная строка: «После этого можно сдавать отчёт».  
**IMPACT:** Ответ на Q4 без калькулятора.

### Блок 5 — TIMELINE

**WHY:** Сейчас смешаны tx list и business events.  
**WHAT:** Business events: «Подключён банк», «Сдан отчёт ИМНС», «Согласован расход». Не raw journal.  
**IMPACT:** История бизнеса, не бухгалтерская лента.

### Убрать с главной (collapse / delete)

- `ExecutiveBriefing`, `ClientJourneyPanel`, `AIRecommendationPanel` — за «Подробнее» или убрать.
- `DashboardDetailsPanel` charts — optional expand.
- `OnboardingChecklist` — только если profile incomplete.
- Duplicate KPI strip (4 tiles) — **внутри hero**, не отдельно.

---

## 8. Workflow: один процесс

```
Документ → OCR (/scan) → Проверка → Проводка (/accounting/journal) → Отчётность (/reports)
         └──────────── Continuity bar (sticky) ────────────────────────┘
```

**WHY:** Сейчас три разных shell и zone switch.  
**WHAT:** Shared `WorkflowContinuity` component + `OperationalContext` stepper на scan/journal/reports.  
**IMPACT:** Ощущение одного потока, не трёх модулей.

---

## 9. Workspace бухгалтера (TaxDome / Karbon / Canopy)

**WHY:** Бухгалтер думает очередями и дедлайнами, не «карточками клиентов».  
**WHAT:** Role=accountant home = **Unified Queues**:

| Очередь | Источник API |
|---------|--------------|
| Сроки | `workspaceApi.accountantOverview().deadlines` |
| OCR | `totals.pending_ocr` per org |
| Входящие | global inbox |
| Согласования | global approvals |
| Риски | `attention_issues` |

**Primary CTA:** «Открыть следующую задачу» (auto-switch org).  
**IMPACT:** Один экран вместо workspace + queues + operations.

---

## 10. Copy guidelines

### Запрещено (удалить из UI)

- Business OS, Trust Surface, Operational Health, Reliability Index, Automation Confidence, Financial State (as nav label)

### Использовать

| Ситуация | Copy |
|----------|------|
| Всё OK | «Всё под контролем» |
| Есть риск | «Есть риск» + что именно |
| Нужно действие | «Требуется действие» |
| Отчётность | «Можно подавать отчётность» / «Не хватает документов» |
| OCR | «Проверить документы» (не «pending OCR») |

---

## 11. Mobile first checklist

| Экран | 30s action possible? | Fix |
|-------|---------------------|-----|
| `/` | ⚠️ Partial — много scroll | Hero + 1 CTA above fold |
| `/operations` | ❌ Long feed | Home top-1; operations simplified |
| `/accounting/journal` | ⚠️ | Sticky bulk actions (exists) |
| `/scan` | ✅ | Keep |
| `/reports` | ⚠️ | Sticky submit (exists) |
| `/inbox` | ✅ | 3-col → stack on mobile OK |
| `/workspace/queues` | ✅ | Primary for accountant |

---

## 12. План реализации (порядок работ)

| Phase | Scope | Code? |
|-------|-------|-------|
| **0** | Этот документ — audit + IA + deletion map | ✅ Done |
| **1** | `navConfig`: 5 zones, remove Control; redirects | ✅ Done |
| **2** | Home rebuild: 5 blocks, single data hook | ✅ Done |
| **3** | Merge inbox/approvals; accountant queues home | ✅ Done |
| **4** | Remove hub landing; journal default | ✅ Done |
| **5** | Workflow continuity bar (scan→journal→reports) | ✅ Done (`WorkflowContinuityBar`) |
| **6** | Copy pass + delete orphan pages | ✅ Done |
| **7** | Mobile pass + 15s user test | ✅ Done (mobile home trim, queue tabs) |

**Не начинать Phase 1 без подтверждения** карты удалений (раздел 6).

---

## 13. Приложение: сводная таблица всех canonical routes

| Route | Zone (target) | Tier | Action |
|-------|---------------|------|--------|
| `/` | Сегодня | P0 | Rebuild |
| `/operations` | Сегодня | P1 | Demote nav |
| `/inbox` | Сегодня | P0 | Merge tabs |
| `/approvals` | Сегодня | P0 | → inbox tab |
| `/accounting/journal` | Деньги | P0 | Default money |
| `/bank` | Деньги | P0 | Keep |
| `/documents` | Деньги | P2 | Keep |
| `/counterparties` | Деньги | P2 | Keep |
| `/accounting/fixed-assets` | Деньги | P2 | Keep |
| `/scan` | Деньги | P0 | Workflow |
| `/accounting/chart` | Настройки | P3 | Move nav |
| `/reports` | Отчётность | P0 | Keep |
| `/reports/:authority` | Отчётность | P0 | Keep |
| `/calendar` | Отчётность | P1 | Tab |
| `/employees/*` | Команда | P0 | Keep |
| `/planner` | Команда | P1 | Keep |
| `/workspace` | Команда | P0 | Accountant |
| `/workspace/queues` | Команда | P0 | Merge workspace |
| `/settings` | Настройки | P0 | Keep |
| `/control/state` | — | — | **Delete → /** |
| `/control/trust` | — | — | **Delete → /** |
| `/accounting/hub` | — | — | **Delete → journal** |
| `/analytics` | — | — | **Demote** |
| `/assistant` | Настройки | P3 | Demote |
| `/notes` | — | — | **Delete** |
| `/admin/ops` | Настройки | P3 | Admin only |

---

*Реализовано: 5-zone nav, Business Control Center home, unified queue, redirects, `WorkflowContinuityBar`, удалены orphan routes/pages.*
