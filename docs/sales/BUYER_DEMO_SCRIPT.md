# Buyer Demo Script (7 minutes)

Goal: prove business value, reliability, and readiness for bank white-label rollout.

## 0:00 - 0:45 Business framing

- Problem: SME accounting friction and churn risk for banks.
- Positioning: FinKlik as ready white-label module, not a prototype.

## 0:45 - 2:30 Core product flow

1. Open transactions and create income/expense.
2. Show automatic totals and dashboard response.
3. Generate primary document (invoice).

## 2:30 - 4:30 Payment flow reliability

1. Open invoice payment QR modal.
2. Show payment link and status polling.
3. Trigger webhook payment event (prepared demo action).
4. Show status change to `paid` and payment events timeline.
5. Emphasize idempotency (`payment_id`) and conflict handling.

## 4:30 - 5:45 Tax compliance flow

1. Open Taxes page.
2. Show regulatory version/year, assumptions, breakdown.
3. Open tax rules validation status widget.
4. Show fallback warning behavior (pre-recorded or staging scenario).

## 5:45 - 6:30 Operational confidence

- Show `/metrics` endpoint and mention fallback counter alerting.
- Mention secure webhook validation and masked logging.
- Mention CI checks for payment-critical smoke.

## 6:30 - 7:00 Commercial close

- 4-8 weeks to branded rollout.
- Integration model with bank ABS and support SLA.
- Next step: NDA + technical due diligence sandbox access.

## Demo Checklist

- At least one `issued` and one `paid` invoice in demo tenant.
- Tax rules widget visible and healthy (`using_fallback=false`).
- Backup scenario available for fallback warning screen.
- Contact slide prepared with next action and timeline.
