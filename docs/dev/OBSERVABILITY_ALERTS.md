# Observability Alerts and Dashboard

Production monitoring baseline for Sprint 10 stabilization.

## Ready-to-import Grafana dashboard

- File: `docs/dev/GRAFANA_DASHBOARD_MINIMAL.json`
- Import path in Grafana: **Dashboards -> New -> Import -> Upload JSON file**
- Datasource: select your Prometheus datasource during import

## Key Metrics

- `tax_rules_validate_fallback_total{cause="missing|error"}`
- `http_requests_total` (via FastAPI instrumentator)
- `http_request_duration_seconds` (latency)

## Alert Rules (Prometheus examples)

### 1) Tax rules fallback started happening

```promql
increase(tax_rules_validate_fallback_total[24h]) > 0
```

Severity: `warning`  
Action: open `Taxes` page and check fallback reason, then validate `tax_rules.json`.

### 2) Tax rules fallback continues after fix window

```promql
increase(tax_rules_validate_fallback_total[1h]) > 3
```

Severity: `critical`  
Action: incident mode, rollback latest config update, restore known good `tax_rules.json`.

### 3) Webhook reject spike (payment + 1C provision)

If logs are shipped to Loki/ELK, configure query on:

- `payment_webhook_rejected`
- `onec_provision_webhook_rejected`

Threshold suggestion: more than 10 rejects in 10 minutes.

## Dashboard Panels (Grafana)

1. **Tax Rules Fallback (24h)**  
   `increase(tax_rules_validate_fallback_total[24h])`

2. **Fallback by cause**  
   `sum by (cause) (increase(tax_rules_validate_fallback_total[24h]))`

3. **API latency p95**  
   `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`

4. **HTTP error rate**  
   `sum(rate(http_requests_total{status=~"5.."}[5m]))`

5. **Webhook reject count (logs)**  
   Log-based panel from structured events.

## Runbook Links

- `docs/dev/TAX_RULES_RUNBOOK.md`
- `docs/dev/RELEASE_READINESS_CHECKLIST.md`
