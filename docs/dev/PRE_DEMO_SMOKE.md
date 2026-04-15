# Pre-Demo Smoke (3-5 minutes)

Run this quick checklist right before a buyer call.

## 1) Health and Readiness

- Open `/health` and confirm service is reachable.
- Confirm latest CI pipeline is green (buyer-demo + payment-critical smoke).
- Optional: open `release-summary` artifact from latest CI run.

## 2) Payment Flow Smoke

1. Open invoice with QR modal.
2. Confirm status badge and payment link are visible.
3. Confirm payment events timeline is loading.
4. Confirm at least one paid invoice is available for proof.

## 3) Tax Flow Smoke

1. Open Taxes page.
2. Confirm breakdown and assumptions are rendered.
3. Confirm tax validation widget is present.
4. Confirm no fallback warning in normal demo scenario.

## 4) Backup Branches

- If email provider is down: show graceful fallback (`email_sent=false`).
- If live webhook cannot be triggered: use pre-paid invoice + timeline evidence.
- If tax rules config is intentionally broken in staging: show fallback reason behavior and then revert.

## 5) Final Slide Readiness

- Contact and next step (NDA + technical due diligence) are prepared.
- Timeline statement ("4-8 weeks to white-label rollout") is included.
