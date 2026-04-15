# Release Readiness Checklist

Use this checklist before demo/release cut.

## 1) Build and Lint

- Backend: `python -m flake8 app tests --config=.flake8`
- Backend unit tests: `python -m pytest tests/unit -q`
- Backend buyer smoke: `python -m pytest tests/integration/test_buyer_smoke.py -q`
- Frontend build: `npm run build`
- Frontend lint (if enabled in project): `npm run lint`

## 2) API Smoke

- `GET /health` returns `status=ok|degraded` with expected DB state.
- `GET /api/v1/health` returns `status=ok`.
- `GET /metrics` returns Prometheus exposition.

## 3) Critical Flow Smoke

- Invoice payment QR opens and status polling works.
- `POST /primary-documents/webhooks/payment`:
  - accepts valid secret
  - rejects bad secret
  - preserves idempotency by `payment_id`
- `GET /primary-documents/{id}/payment-events` returns summary counters.
- `GET /tax/rules/validate` for owner:
  - `using_fallback=false` in healthy config
  - fallback reason visible in UI when config is invalid
- CI must include:
  - `Buyer Demo Smoke` job
  - `Payment Critical Smoke` job

## 4) Security Smoke

- Security headers present on API responses.
- Webhook secrets are never logged in plain text.
- SSRF protections remain active for outbound integrations.

## 5) Buyer Demo Prep

- Demo account has seeded org + sample docs.
- At least one invoice in `issued` and one in `paid`.
- Tax page shows calculation, rules version, and validation widget.
- Backup plan prepared in case external email API is disabled.
- Follow `docs/dev/DEMO_TENANT_CHECKLIST.md` for stable demo tenant state.
- Run `docs/dev/PRE_DEMO_SMOKE.md` before the call.
