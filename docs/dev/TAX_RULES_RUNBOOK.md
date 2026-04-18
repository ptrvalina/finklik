# Tax Rules Runbook

This runbook describes how to maintain tax rules configuration for production tax calculations.

## Files and Endpoints

- Config file: `backend/api-gateway/app/config/tax_rules.json`
- Validation endpoint: `GET /api/v1/tax/rules/validate` (owner only)
- Metrics endpoint: `GET /metrics`
- Fallback counter: `tax_rules_validate_fallback_total`

## Update Process

1. Open `tax_rules.json`.
2. Add or update year block under `years`.
3. Keep all required keys for each year:
   - `usn_rate_with_vat`
   - `usn_rate_without_vat`
   - `vat_rate`
   - `fsszn_employer`
   - `fsszn_employee`
4. Optional informational fields (ignored by the parser) may include `vat_rates_applicable` (e.g. `10%,20%,25%`).
5. Save file in valid JSON format (UTF-8).
6. Run local validation via API:
   - call `GET /api/v1/tax/rules/validate` as owner
   - confirm `ok=true` and `using_fallback=false`

## Fallback Meaning

If validation response has `using_fallback=true`, API uses embedded default tax rules instead of config.

Common reasons:

- Config file is missing
- JSON is malformed
- Required fields are missing
- Numeric values cannot be parsed

## Incident Checklist (using_fallback=true)

1. Open Taxes page and check "Причина fallback" field.
2. Call `GET /api/v1/tax/rules/validate` and inspect `errors[0]`.
3. Fix `tax_rules.json` and redeploy/restart service if needed.
4. Re-run validation and confirm:
   - `ok=true`
   - `using_fallback=false`
5. Verify `/metrics` trend:
   - `tax_rules_validate_fallback_total` should stop growing after fix.

## Monitoring Recommendation

- Alert if `tax_rules_validate_fallback_total` increases within last 24h.
- Include `errors[0]` in on-call dashboard/log panel for quick diagnosis.
