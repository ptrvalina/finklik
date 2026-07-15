#!/usr/bin/env python3
"""Bring up production-like pilot stack and run PILOT_TARGET=production gate.

Usage:
  python scripts/pilot_prod_gate.py
  python scripts/pilot_prod_gate.py --down
  python scripts/pilot_prod_gate.py --check-only   # stack already running

Requires Docker. Writes/uses backend/api-gateway/.env.pilot.local (gitignored).
"""

from __future__ import annotations

import argparse
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def _root() -> Path:
    return Path(__file__).resolve().parent.parent


def _compose_cmd() -> list[str]:
    return [
        "docker",
        "compose",
        "-f",
        str(_root() / "infrastructure" / "docker" / "docker-compose.pilot.yml"),
    ]


def _http_ok(url: str, timeout: float = 4.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _ensure_pilot_env(env_path: Path, example_path: Path) -> None:
    if env_path.is_file():
        text = env_path.read_text(encoding="utf-8")
    elif example_path.is_file():
        text = example_path.read_text(encoding="utf-8")
    else:
        text = ""

    if "REPLACE_JWT" in text or "dev_secret_key_finklik" in text or not env_path.is_file():
        jwt = secrets.token_hex(32)
        refresh = secrets.token_hex(32)
        email_key = f"pilot-local-{secrets.token_hex(8)}"
        text = (
            text.replace("REPLACE_JWT_SECRET", jwt)
            .replace("REPLACE_JWT_REFRESH", refresh)
            .replace("REPLACE_EMAIL_API_KEY", email_key)
        )
        env_path.write_text(text, encoding="utf-8")
        print(f"Wrote pilot env → {env_path}")


def _run(cmd: list[str], *, cwd: Path | None = None, check: bool = True) -> int:
    print(f"$ {' '.join(cmd)}")
    r = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    if check and r.returncode != 0:
        raise SystemExit(r.returncode)
    return r.returncode


def _wait_api(base: str, seconds: int = 120) -> None:
    url = f"{base.rstrip('/')}/health"
    deadline = time.time() + seconds
    while time.time() < deadline:
        if _http_ok(url):
            print(f"API ready: {url}")
            return
        time.sleep(2)
    raise SystemExit(f"API not ready after {seconds}s: {url}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Production pilot gate (Docker + pilot-check)")
    parser.add_argument("--down", action="store_true", help="Stop pilot stack")
    parser.add_argument("--check-only", action="store_true", help="Skip docker up; run pilot-check only")
    parser.add_argument("--api-url", default="http://localhost:8010", help="Pilot API base URL")
    parser.add_argument("--with-e2e", action="store_true", help="Also run Playwright pilot smoke")
    args = parser.parse_args()

    root = _root()
    env_path = root / "backend" / "api-gateway" / ".env.pilot.local"
    example_path = root / "backend" / "api-gateway" / ".env.pilot.example"

    if args.down:
        _run(_compose_cmd() + ["down"], check=False)
        return 0

    if not args.check_only:
        _ensure_pilot_env(env_path, example_path)
        os.environ.setdefault("PILOT_DB_PASSWORD", "finklik_pilot_dev")
        _run(_compose_cmd() + ["up", "-d", "--build"])
        _wait_api(args.api_url)

    env = os.environ.copy()
    env["PILOT_TARGET"] = "production"
    env["PILOT_API_URL"] = args.api_url
    env["PILOT_ENV_FILE"] = str(env_path)
    env["PILOT_LIMITATIONS_ACK"] = "1"

    py = sys.executable
    r = subprocess.run([py, str(root / "scripts" / "pilot_check.py")], cwd=str(root), env=env)
    if r.returncode != 0:
        return r.returncode

    if args.with_e2e:
        env["PILOT_E2E_API_URL"] = args.api_url
        e2e = subprocess.run([py, str(root / "scripts" / "pilot_e2e.py")], cwd=str(root), env=env)
        if e2e.returncode != 0:
            return e2e.returncode

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
