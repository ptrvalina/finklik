# FinClick — Belarus Financial OS Pass (Master Plan)

**Цель:** довести FinClick до production-ready **Financial Operating System** для SMB РБ без редизайна и без ERP-раздувания — стабилизация, локализация, учётный фундамент, OCR, execution-слой, бухгалтерский контур, готовность к первым платящим клиентам.

**Принцип:** всё внутри существующей архитектуры (`event-driven` + `FinancialState` + `operations_feed` + `business_os` + journal-first UX).

---

## Текущее состояние (baseline на момент плана)

| Область | Статус | Где в коде |
|--------|--------|------------|
| Auth, refresh cookie, session revoke | ✅ Работает | `auth.py`, `auth_security_events.py` |
| Multi-org, accountant workspace | ✅ Работает | `workspace.py`, `collaboration`, `OrgSwitcher` |
| Execution feed + Financial state | ✅ API + UI | `operations_feed.py`, `OperationsPage.tsx` |
| Business OS (entities, obligations, reconciliation) | ✅ Частично | `business_os.py`, `business_os` models |
| Journal (income/expense), categories, rules | ✅ Работает | `transactions.py`, `Accounting.tsx` |
| OCR / scanner | ⚠️ Tesseract + mock fallback | `ocr_service.py`, `scanner.py` |
| Reporting mock/http | ✅ Без реальных порталов | `report_submission.py` |
| Workforce ФСЗН/зарплата | ✅ API; RPA — env | `workforce.py`, `employees` |
| План счетов РБ (Приказ №50) | ❌ Нет полного справочника | Только 12 счетов в `onec.py` CHART_OF_ACCOUNTS |
| Двойная запись / проводки | ❌ Нет | Операции = журнал, не ledger entries |
| Забалансовые счета | ❌ Нет | — |
| Амортизация ОС/НМА | ❌ Нет | — |
| ОКЭД справочник | 🟡 Старт (эта ветка) | `oked_reference`, `/api/v1/oked/search` |
| Полная RU локализация | 🟡 Частично | `navConfig` RU; разрозненные EN в UI/коде |
| Отраслевые «теги» | ⚠️ Упрощённо | `legal_form`, `tax_regime` на `organizations` |

**Отложено до внешних контуров:** реальные госAPI, ЭЦП, XSD/XML порталов — [`SPRINT_DEFERRED_EXTERNAL.md`](SPRINT_DEFERRED_EXTERNAL.md).

---

## Фазы (рекомендуемый порядок)

### Фаза A — Foundation (2–3 недели) · *можно начинать сразу*

| ID | Задача | Результат |
|----|--------|-----------|
| A1 | Единая терминология RU | `frontend/web/src/i18n/terminology.ru.ts`, `messages.ru.ts` |
| A2 | Аудит EN-строк | скрипт `scripts/audit_ui_language.py` + чеклист |
| A3 | Calm errors | централизованные тексты API/UI |
| A4 | ОКЭД: справочник + поиск + профиль org | миграция, seed, API, onboarding step |
| A5 | События профиля | `OkedSelected`, `TaxModeSelected`, `BusinessProfileCompleted` |
| A6 | Production checklist | обновить `RELEASE_STAGE7` + first-client runbook |

**Не делать в A:** полный план счетов 01–99 — только подготовка модели.

### Фаза B — OCR hardening (2 недели)

| ID | Задача |
|----|--------|
| B1 | Preprocessing pipeline (grayscale, threshold, deskew, crop) |
| B2 | Типы документов РБ (чек, счёт, акт, платёжка, накладная) |
| B3 | Парсеры BYN, УНП, ИП/ООО, даты |
| B4 | Confidence per field + `requires_review` |
| B5 | Fast correction UI (<10 сек цель) |
| B6 | OKED-aware heuristics в `ocr_service` |

### Фаза C — Accounting core (4–6 недель) · *критический путь*

| ID | Задача |
|----|--------|
| C1 | Модель `chart_accounts` (official, immutable delete) |
| C2 | Импорт справочника из `app/data/chart_of_accounts_rb.json` (Приказ №50 + актуальные ред.) |
| C3 | `chart_subaccounts` — иерархия, CRUD для аналитики |
| C4 | `ledger_entries` — проводки, связь с operations |
| C5 | Забалансовые 001–011 |
| C6 | UI «План счетов» (tree, search) — **advanced mode only** |
| C7 | Journal-first: SMB видит журнал; бухгалтер — дебет/кредит |

**Compliance:** юридическую актуальность счетов верифицировать по официальному источнику Минфина; JSON — версионируемый артефакт с `effective_date`.

### Фаза D — ОС / НМА / амортизация (2–3 недели)

| ID | Задача |
|----|--------|
| D1 | `fixed_assets`, методы (linear, optional declining) |
| D2 | Monthly job → проводки 01/02, 04/05 |
| D3 | Events → execution feed + FinancialState |

### Фаза E — Execution activation (2 недели)

| ID | Задача |
|----|--------|
| E1 | Проверить все dormant endpoints подключены во фронте |
| E2 | Work packs ack, trust surface, predictions |
| E3 | Accountant inbox/approvals/comments smoke |

### Фаза F — Polish & first clients (2 недели)

| ID | Задача |
|----|--------|
| F1 | UI precision pass (forms, tables, mobile) |
| F2 | Performance (virtualization, query keys) |
| F3 | Demo tenant + onboarding <2 мин |
| F4 | Backup/audit documentation |

---

## Part → Phase mapping

| Spec Part | Phase |
|-----------|-------|
| 1 RU localization | A |
| 2 OCR | B |
| 3–4 Accounting + subaccounts | C |
| 5 Amortization | D |
| 6 Industry → **6.1 OKED** | A (+ B/C hooks) |
| 7 Journal-first UX | C + E |
| 8 Plan of accounts UI | C |
| 9 Execution activation | E |
| 10 Accountant workspace | E |
| 11 Reporting | E (уже mock-stable) |
| 12 Trust/security | A + E (частично есть) |
| 13–14 UI/perf | F |
| 15 First client | A6 + F |
| 16 Events integration | A5 + сквозно |

---

## OKED (Part 6.1) — архитектура

```
oked_reference (global)
    ↓ search
onboarding / settings
    ↓
organizations.oked_primary, oked_secondary_json, employee_count_band
    ↓ events
FinancialState · work packs · OCR heuristics · tax hints
```

**Не использовать** упрощённые industry-tags как primary — только ОКЭД + `legal_form` + `tax_regime`.

Популярные коды — в seed; полный классификатор — импорт CSV Belstat (отдельная задача данных).

---

## События (Part 16)

Добавлены константы в `app/events/constants.py`:

- `AccountCreated`, `SubaccountCreated`, `AmortizationGenerated`
- `OkedSelected`, `TaxModeSelected`, `BusinessProfileCompleted`
- `WorkPackAcknowledged` (если ещё нет отдельного имени)

Эмиттеры — по мере фаз C/D/A; обработчики — существующий `domain_events` + проекции `operations_feed_service`.

---

## Success criteria (из spec) — честная шкала

| # | Критерий | После фазы |
|---|----------|------------|
| 1 | UI полностью RU | A |
| 2 | OCR надёжен для РБ | B |
| 3–5 | План счетов + забаланс + субсчета | C |
| 6 | Амортизация | D |
| 7–8 | Бухгалтер + Financial OS | E |
| 9–11 | Reporting + polish + mobile | E–F |
| 12–15 | First SMB clients | F |

---

## Статус реализации (2026-05-22)

| Фаза | Статус | Что в коде |
|------|--------|------------|
| A | 🟢 Основа | `i18n/`, onboarding `/onboarding/business-profile`, ОКЭД API, calm errors, nav RU |
| B | 🟢 Основа | `ocr_preprocess.py`, `belarus_ocr_parse.py`, field confidence, `requires_review` |
| C | 🟢 Основа | `chart_of_accounts_rb.json`, models, `/accounting/chart`, субсчета, ledger, UI план счетов |
| D | 🟢 Основа | `fixed_assets`, `run_monthly_amortization`, events |
| E | 🟢 Частично | WorkPack ack → event; execution API уже был |
| F | 🟢 Основа | OCR field highlights, onboarding banner, accounting mode, runbooks, RELEASE_STAGE7 §7 |

**Остаётся для полноты spec:** импорт полного классификатора ОКЭД (CSV Belstat), юридическая верификация всех субсчетов №50, полный i18n-аудит всех страниц, продвинутый OCR UI (<10 сек), mobile safe-area pass.

**Миграции:** `oked_org_profile_v1` → `belarus_fos_accounting_v1` — выполнить `alembic upgrade head` на целевой БД.
