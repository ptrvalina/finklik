# OneC Integration Contract

## Purpose

This document defines the stable contract between FinKlik and external 1C HTTP services.
All endpoints use `application/json` over HTTPS.

## Authentication

- Header: `Authorization: Bearer <onec_token>`
- For transaction sync calls, FinKlik also sends:
  - `Idempotency-Key: <organization_id>:<transaction_id>`

## Endpoints

### `GET /health`

Health check for one organization-specific 1C contour.

**200 Response**

```json
{
  "platform": "1C:Enterprise 8.3",
  "infobase": "CompanyA_Main"
}
```

### `GET /counterparties`

Returns full counterparty dictionary for sync.

**200 Response**

```json
{
  "counterparties": [
    {
      "name": "ООО Пример",
      "unp": "123456789",
      "address": "г. Минск, ул. Примерная, 1",
      "account": "BY00TEST30120000000000000000"
    }
  ]
}
```

OData-compatible variant is also supported:

```json
{
  "value": [
    {
      "name": "ООО Пример",
      "unp": "123456789",
      "address": "г. Минск, ул. Примерная, 1",
      "account": "BY00TEST30120000000000000000"
    }
  ]
}
```

### `GET /counterparties/{unp}`

Single counterparty lookup by UNP.

**200 Response (found)**

```json
{
  "name": "ООО Пример",
  "unp": "123456789",
  "address": "г. Минск, ул. Примерная, 1",
  "account": "BY00TEST30120000000000000000"
}
```

**200 Response (not found)**

```json
{
  "found": false
}
```

### `GET /counterparties/search?q=<query>`

Search counterparties by name or UNP.

**200 Response**

```json
{
  "results": [
    {
      "name": "ООО Пример",
      "unp": "123456789",
      "address": "г. Минск, ул. Примерная, 1",
      "account": "BY00TEST30120000000000000000"
    }
  ]
}
```

### `GET /accounts`

Returns chart of accounts.

**200 Response**

```json
{
  "accounts": [
    { "code": "51", "name": "Расчетные счета", "type": "active" }
  ]
}
```

OData-compatible variant:

```json
{
  "value": [
    { "code": "51", "name": "Расчетные счета", "type": "active" }
  ]
}
```

### `POST /transactions/sync`

Receives one transaction for sync from FinKlik to 1C.

**Request**

```json
{
  "transaction_id": "0cb93a53-9f89-42ad-9a1f-55f8a5074c3f",
  "type": "income",
  "amount": 120.5,
  "vat_amount": 20.08,
  "currency": "BYN",
  "counterparty_id": "7f7ab3b4-5b9d-44f0-a9ec-6eb2999d51d4",
  "category": "sales",
  "description": "Оплата по счету INV-2026-001",
  "transaction_date": "2026-04-14"
}
```

**200 Response**

```json
{
  "external_id": "1C-TX-2026-000123",
  "status": "accepted"
}
```

Alternative accepted response fields: `onec_id`, `id`.

## Error Handling

### HTTP Statuses

- `400` Invalid payload or query parameters
- `401` Invalid/expired token
- `403` Forbidden for contour or tenant
- `404` Entity not found
- `409` Conflict
- `429` Rate limited
- `500` Internal 1C service error
- `502` Temporary upstream problem
- `503` Service unavailable

### Error Response Body

```json
{
  "error_code": "ONEC_VALIDATION_ERROR",
  "message": "Counterparty is not valid",
  "details": {
    "field": "counterparty_id"
  }
}
```

## Idempotency Requirements

- 1C side must treat repeated requests with same `Idempotency-Key` as one logical operation.
- Repeated calls must return same resulting external transaction reference.

## Timeouts and Retries

- FinKlik request timeout: 15 seconds for `/transactions/sync`.
- FinKlik retries by queue policy: status `retry` until `max_attempts`, then `failed`.
- FinKlik exposes retry actions in UI and API.
