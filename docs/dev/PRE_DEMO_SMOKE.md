# Pre-Demo Smoke (3-5 minutes)

Run this quick checklist right before a buyer call.

## Fast Command

```bash
make demo-smoke
```

Alternative:

```bash
python scripts/pre_demo_smoke.py
```

The command writes summary to `artifacts/pre-demo-smoke-summary.md`.

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

## 3b) Scanner (post v0.2.0)

1. Confirm API DB has migration `sprint10_scanned_documents` applied (`scanned_documents` table exists).
2. Upload a small JPG or PDF on Scanner page — success, result card, optional «Предупреждения» if OCR used mock fallback.
3. Recent scans list loads without 500.

## 3c) Regulatory & report submissions (roadmap sprints 11–12 slice)

1. Confirm migration `sprint12_regulatory_reporting` is applied (tables `regulatory_updates`, `report_submissions` exist) — see `docs/dev/PRODUCT_SPRINT_ALIGNMENT.md` and `docs/dev/DEPLOY_RUNBOOK.md`.
2. **Settings → Регламентные обновления**: list loads, optional seed updates on first call.
3. **Settings → Подача отчётов**: create a mock report (e.g. ФСЗН / ПУ-3), confirm, submit — success message with reference.
4. In **Просмотр** for a submission: optional **Скачать файл** buttons (same exports as **Документы**) load without error for ИМНС УСН/НДС or ФСЗН ПУ-3 when applicable.

## 4) Backup Branches

- If email provider is down: show graceful fallback (`email_sent=false`).
- If live webhook cannot be triggered: use pre-paid invoice + timeline evidence.
- If tax rules config is intentionally broken in staging: show fallback reason behavior and then revert.

## 5) Final Slide Readiness

- Contact and next step (NDA + technical due diligence) are prepared.
- Timeline statement ("4-8 weeks to white-label rollout") is included.
