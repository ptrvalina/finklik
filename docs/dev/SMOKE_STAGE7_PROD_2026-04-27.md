# Production Smoke Report (Stage 7)

Date: 2026-04-27  
Target: `https://finklik-api.onrender.com`

## Executed checks

- `GET /health`
- `GET /api/v1/health`
- `GET /openapi.json`
- `GET /health?access_token=fake` (JWT query-param block check)
- `POST /api/v1/auth/refresh` with empty JSON body
- OpenAPI path presence: `"/api/v1/auth/refresh"`

## Results

- `GET /health` => **200**
- `GET /api/v1/health` => **200**
- `GET /openapi.json` => **200**
- OpenAPI contains `"/api/v1/auth/refresh"` => **yes**
- `GET /health?access_token=fake` => **200** (expected: **400**)
- `POST /api/v1/auth/refresh` with `{}` => **422** (expected stage-6 behavior: **401** when token missing)

## Notes

- API reachable and OpenAPI published.
- Production behavior for JWT query blocking and refresh-empty handling does not match latest stage-6 expectations.
- Most likely causes: stale deployment version or env/config drift.

## Recommended next actions

1. Verify running backend revision equals commit `1cc9dd2`.
2. Re-run smoke after redeploy and migration rollout.
3. If mismatch persists, compare `app/main.py` middleware chain and `auth.refresh` schema handling on deployed artifact.

