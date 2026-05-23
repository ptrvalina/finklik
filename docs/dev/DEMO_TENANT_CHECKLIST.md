# Demo Tenant Checklist

Use this checklist to keep the buyer demo tenant stable and repeatable.

## Target State

- One organization with owner account ready to login.
- At least two invoices:
  - one with `status=issued`
  - one with `status=paid`
- Payment events timeline has both:
  - `payment_link_sent`
  - `webhook_paid` or `manual_mark_paid`
- Taxes page shows:
  - regulatory version/year
  - assumptions and breakdown
  - tax rules validation widget with `using_fallback=false`

## Data Preparation Steps

1. Register or login as demo owner.
2. Complete **business profile** (`/onboarding/business-profile`): OKED, tax regime, employee band.
3. Optional: Settings → **Advanced accounting** → seed chart at `/accounting/chart`.
4. Create baseline transactions (income + expense) for visible tax calculation.
5. Create invoice A (`issued`) and generate QR/payment link.
6. Create invoice B and mark it paid via webhook or UI.
7. Verify `/primary-documents/{id}/payment-events` summary counters.
8. Open Taxes page and verify no fallback warning in normal scenario.

## Reset Plan

- Keep one script/seed source for demo data.
- Before each live demo:
  - clear/refresh demo org data
  - re-create the same two invoices
  - verify payment/tax widgets in UI

## Fallback Plan (if integrations are unavailable)

- If email API is unavailable, show `email_sent=false` behavior as graceful degradation.
- If external webhook cannot be triggered live, use prepared paid invoice and timeline evidence.
