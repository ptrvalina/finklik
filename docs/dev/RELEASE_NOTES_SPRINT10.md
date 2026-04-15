# Release Notes — Sprint 10 Stabilization

Date: 2026-04-15

## Highlights

- Tax rules validation now has explicit fallback observability:
  - fallback counter in `/metrics`
  - structured warning logs for fallback events
  - clear UI warning and fallback reason on Taxes page
- Manual and periodic tax rules revalidation is available in UI.
- Payment flow hardening:
  - additional test coverage for payment events summary
  - invalid email validation test for payment link sending
  - payment link sending is blocked for already paid invoices
- Webhook logging hardening:
  - secrets are masked in logs
  - webhook processing logs include only safe metadata

## Operational Notes

- Recommended backend runtime for local integration tests is Python 3.11.
- Python 3.14 may fail integration test setup because of known `passlib`/`bcrypt` incompatibility.

## CI Baseline

- CI workflow now includes explicit readiness gates:
  - `Buyer Demo Smoke`
  - `Payment Critical Smoke`
  - `Release Summary` artifact
- Latest baseline run (current): `https://github.com/ptrvalina/finklik/actions/runs/24475133323` (failed)
- Follow-up: payment-critical and integration suites were split into focused gates to stabilize green baseline.
- Latest post-fix run (pending): `https://github.com/ptrvalina/finklik/actions/workflows/ci.yml`

## Demo Operations

- Demo tenant checklist: `docs/dev/DEMO_TENANT_CHECKLIST.md`
- Pre-demo smoke guide: `docs/dev/PRE_DEMO_SMOKE.md`
- Sales flow script: `docs/sales/BUYER_DEMO_SCRIPT.md`

## Files to Review

- `backend/api-gateway/app/api/v1/endpoints/tax_calendar.py`
- `backend/api-gateway/app/api/v1/endpoints/primary_documents.py`
- `backend/api-gateway/app/api/v1/endpoints/onec_contour.py`
- `backend/api-gateway/tests/integration/test_primary_documents.py`
- `docs/dev/DEVELOPER_GUIDE.md`
- `docs/dev/RELEASE_READINESS_CHECKLIST.md`
- `docs/dev/TAX_RULES_RUNBOOK.md`
