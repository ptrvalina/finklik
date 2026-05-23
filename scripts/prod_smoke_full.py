#!/usr/bin/env python3
"""Full production smoke against running API (BASE_URL + credentials)."""

from __future__ import annotations

import os
import sys

try:
    import httpx
except ImportError:
    print("pip install httpx")
    sys.exit(1)

BASE = os.environ.get("SMOKE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
EMAIL = os.environ.get("SMOKE_EMAIL", "")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "")


def main() -> int:
    failures: list[str] = []
    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        r = client.get("/health")
        if r.status_code != 200:
            failures.append("health")
        r = client.get("/api/v1/health")
        if r.status_code != 200:
            failures.append("api_health")

        if EMAIL and PASSWORD:
            login = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})
            if login.status_code != 200:
                failures.append("auth_login")
            else:
                token = login.json().get("access_token")
                headers = {"Authorization": f"Bearer {token}"}
                for path in (
                    "/api/v1/team/organization/business-profile",
                    "/api/v1/accounting/chart/tree",
                    "/api/v1/accounting/mode",
                    "/api/v1/oked/popular",
                    "/api/v1/operations/feed",
                ):
                    rr = client.get(path, headers=headers)
                    if rr.status_code >= 400:
                        failures.append(path)
        else:
            print("SKIP authenticated checks (set SMOKE_EMAIL, SMOKE_PASSWORD)")

    if failures:
        print("FAILED:", failures)
        return 1
    print("Smoke OK:", BASE)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
