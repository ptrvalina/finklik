"""Имитирует cross-origin запрос логина с GitHub Pages для диагностики прода."""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

API = "https://finklik-api.onrender.com"
ORIGIN = "https://ptrvalina.github.io"


def preflight() -> tuple[int, dict[str, str]]:
    req = urllib.request.Request(
        f"{API}/api/v1/auth/login",
        method="OPTIONS",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, dict(r.headers.items())


def login(email: str, password: str) -> tuple[int, dict[str, str], str]:
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        f"{API}/api/v1/auth/login",
        method="POST",
        data=body,
        headers={
            "Origin": ORIGIN,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, dict(r.headers.items()), r.read().decode()
    except urllib.error.HTTPError as exc:
        return (
            exc.code,
            dict(exc.headers.items()) if exc.headers else {},
            exc.read().decode(),
        )


def main() -> int:
    started = time.time()
    print(f"[probe] target={API} origin={ORIGIN}")
    try:
        status, headers = preflight()
    except Exception as exc:
        print(f"[probe] preflight FAILED: {exc!r}")
        return 1
    print(f"[probe] preflight status={status}")
    for key in (
        "access-control-allow-origin",
        "access-control-allow-credentials",
        "access-control-allow-methods",
        "access-control-allow-headers",
    ):
        print(f"  {key}: {headers.get(key, '<missing>')}")

    email = sys.argv[1] if len(sys.argv) > 1 else "demo@finklik.by"
    password = sys.argv[2] if len(sys.argv) > 2 else "demo123"
    status, headers, body = login(email, password)
    print(f"[probe] login status={status} elapsed={time.time()-started:.2f}s")
    print(
        "  acao:",
        headers.get("access-control-allow-origin", "<missing>"),
    )
    print("  body:", body[:600])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
