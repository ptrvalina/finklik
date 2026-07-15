#!/usr/bin/env python3
"""Run Playwright pilot smoke (API + preview + browser).

Usage:
  python scripts/pilot_e2e.py
  PILOT_E2E_API_URL=http://localhost:8010 python scripts/pilot_e2e.py --no-servers
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


def _find_gateway_python() -> list[str]:
    gw = _root() / "backend" / "api-gateway"
    env = os.environ.get("PYTHON_EXE", "").strip()
    if env:
        return [env]
    for rel in (".venv311/Scripts/python.exe", ".venv311/bin/python", ".venv/Scripts/python.exe", ".venv/bin/python"):
        p = gw / rel
        if p.is_file():
            return [str(p)]
    return [sys.executable]


def _http_ok(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=4.0) as resp:
            return resp.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _wait(url: str, seconds: int = 90) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        if _http_ok(url):
            return
        time.sleep(1.5)
    raise SystemExit(f"Timeout waiting for {url}")


def _npm(cmd: list[str], cwd: Path, env: dict[str, str]) -> None:
    if sys.platform.startswith("win") and cmd and cmd[0] == "npm":
        cmd = ["npm.cmd", *cmd[1:]]
    subprocess.run(cmd, cwd=str(cwd), env=env, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-servers", action="store_true", help="Assume API and preview already running")
    parser.add_argument("--api-port", type=int, default=8765)
    parser.add_argument("--web-port", type=int, default=4173)
    args = parser.parse_args()

    root = _root()
    backend = root / "backend" / "api-gateway"
    frontend = root / "frontend" / "web"
    api_url = os.environ.get("PILOT_E2E_API_URL", f"http://127.0.0.1:{args.api_port}")
    web_url = os.environ.get("PILOT_E2E_WEB_URL", f"http://127.0.0.1:{args.web_port}")

    procs: list[subprocess.Popen] = []

    def cleanup() -> None:
        for p in procs:
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    p.kill()

    try:
        if not args.no_servers:
            jwt = secrets.token_hex(32)
            refresh = secrets.token_hex(32)
            db_file = backend / "e2e_pilot.db"
            if db_file.is_file():
                db_file.unlink()

            api_env = os.environ.copy()
            api_env.update(
                {
                    "DATABASE_URL": f"sqlite+aiosqlite:///{db_file.as_posix()}",
                    "JWT_SECRET_KEY": jwt,
                    "JWT_REFRESH_SECRET_KEY": refresh,
                    "DEBUG": "false",
                    "DISABLE_RATE_LIMIT": "1",
                    "CORS_ORIGINS": web_url,
                    "PYTHONPATH": str(backend),
                }
            )
            py = _find_gateway_python()
            subprocess.run(py + [str(backend / "scripts" / "e2e_bootstrap_db.py")], cwd=str(backend), env=api_env, check=True)
            procs.append(
                subprocess.Popen(
                    py + ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(args.api_port)],
                    cwd=str(backend),
                    env=api_env,
                )
            )
            _wait(f"{api_url.rstrip('/')}/health")

            fe_env = os.environ.copy()
            fe_env["VITE_API_URL"] = api_url
            _npm(["npm", "run", "build"], frontend, fe_env)
            procs.append(
                subprocess.Popen(
                    ["npm.cmd" if sys.platform.startswith("win") else "npm", "run", "preview", "--", "--host", "127.0.0.1", "--port", str(args.web_port)],
                    cwd=str(frontend),
                    env=fe_env,
                )
            )
            _wait(web_url)

        test_env = os.environ.copy()
        test_env["PILOT_E2E_API_URL"] = api_url
        test_env["PILOT_E2E_WEB_URL"] = web_url
        test_env["PLAYWRIGHT_BASE_URL"] = web_url

        _npm(["npm", "run", "test:e2e"], frontend, test_env)
        return 0
    except subprocess.CalledProcessError as e:
        return e.returncode or 1
    finally:
        cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
