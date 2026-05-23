# Execution, Trust & Pilot Optimization

| Phase | Статус | Ключевые артефакты |
|-------|--------|-------------------|
| 1 OCR | 🟢 | preprocess v2, validation, `execution_suggestions`, vendor memory |
| 2 Accountant | 🟢 | pin ★ в OrgSwitcher, `pilot/analytics/*` |
| 3 Trust | 🟢 | `ledger_trust_service`, `POST /ledger/{id}/reverse`, `/accounting/trust` |
| 4 UX | 🟡 | scanner suggestions UI; journal shortcuts — итерации |
| 5 Pilot | 🟢 | seed templates + friction summary |
| 6 Financial OS | 🟡 | work packs / trust — baseline есть |
| 7 Accounting | 🟡 | official subaccounts seed; full №50 — data task |

## API (новое)

- `execution_suggestions` в ответе `POST /scanner/upload`
- `POST /pilot/analytics/track`, `GET /pilot/analytics/friction`
- `GET /accounting/trust`, `POST /accounting/ledger/{id}/reverse`
- `PATCH /workspace/memberships/{id}/pin` (уже было)

## Миграция

`execution_trust_pilot_v1` → таблица `pilot_usage_events`
