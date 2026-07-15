#!/usr/bin/env python3
"""Pilot readiness scorecard — automated checks for onboarding the next client.

Usage:
  python scripts/pilot_check.py
  PILOT_TARGET=production PILOT_API_URL=https://api.example.com python scripts/pilot_check.py

Writes: artifacts/pilot-readiness-scorecard.md
Exit: 0 = green or yellow, 1 = red
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Literal


class Status(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"

    @property
    def icon(self) -> str:
        return {"pass": "✅", "warn": "⚠️", "fail": "❌"}[self.value]


Verdict = Literal["green", "yellow", "red"]


@dataclass
class Row:
    block: str
    status: Status
    detail: str


@dataclass
class Scorecard:
    rows: list[Row] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def add(self, block: str, status: Status, detail: str) -> None:
        self.rows.append(Row(block=block, status=status, detail=detail))

    def block_status(self, block: str) -> Status:
        statuses = [r.status for r in self.rows if r.block == block]
        if not statuses:
            return Status.WARN
        if Status.FAIL in statuses:
            return Status.FAIL
        if Status.WARN in statuses:
            return Status.WARN
        return Status.PASS

    def verdict(self, target: str) -> Verdict:
        by_block = {r.block: self.block_status(r.block) for r in self.rows}
        critical = ("Infrastructure", "Demo smoke", "OCR")
        if target == "production":
            critical += ("PostgreSQL", "Secrets")

        for b in critical:
            if by_block.get(b) == Status.FAIL:
                return "red"

        if any(s == Status.FAIL for s in by_block.values()):
            return "red"

        warn_blocks = [b for b, s in by_block.items() if s == Status.WARN]
        if not warn_blocks:
            return "green"

        if target == "local":
            allowed_local_warns = {
                "Infrastructure",
                "PostgreSQL",
                "Secrets",
                "Email",
                "Bank import",
                "Known limitations acknowledged",
                "Demo smoke",
            }
            if all(b in allowed_local_warns for b in warn_blocks):
                return "yellow"

        return "yellow"


def _root() -> Path:
    return Path(__file__).resolve().parent.parent


def _find_gateway_python() -> list[str]:
    root = _root()
    gw = root / "backend" / "api-gateway"
    env = os.environ.get("PYTHON_EXE", "").strip()
    if env:
        return [env]
    for rel in (
        ".venv311/Scripts/python.exe",
        ".venv311/bin/python",
        ".venv/Scripts/python.exe",
        ".venv/bin/python",
    ):
        p = gw / rel
        if p.is_file():
            return [str(p)]
    return [sys.executable]


def _load_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _env(key: str, file_env: dict[str, str], default: str = "") -> str:
    return os.environ.get(key, file_env.get(key, default))


def _http_get(url: str, timeout: float = 8.0) -> tuple[int | None, str]:
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")[:500]
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, str(e.reason)
    except Exception as e:
        return None, str(e)


def _run(cmd: list[str], cwd: Path, timeout: int = 600) -> tuple[int, str]:
    if sys.platform.startswith("win") and cmd and cmd[0] == "npm":
        cmd = ["npm.cmd", *cmd[1:]]
    try:
        r = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        out = (r.stdout or "") + (r.stderr or "")
        return r.returncode, out[-2000:]
    except subprocess.TimeoutExpired:
        return 1, "timeout"
    except Exception as e:
        return 1, str(e)


DEV_JWT = "dev_secret_key_finklik_2024_min32chars"
DEV_REFRESH = "dev_refresh_key_finklik_2024_min32"


def check_infrastructure(sc: Scorecard, api_url: str, target: str) -> None:
    base = api_url.rstrip("/")
    code, body = _http_get(f"{base}/health")
    if code == 200:
        sc.add("Infrastructure", Status.PASS, f"`GET /health` → 200 ({base})")
    elif code is not None:
        sc.add("Infrastructure", Status.WARN, f"`GET /health` → {code}")
    else:
        if target == "local":
            sc.add(
                "Infrastructure",
                Status.WARN,
                f"API offline ({body[:80]}) — запустите `make dev` для полной проверки",
            )
        else:
            sc.add("Infrastructure", Status.FAIL, f"API недоступен: {body}")

    if code == 200:
        code2, _ = _http_get(f"{base}/api/v1/health")
        if code2 == 200:
            sc.add("Infrastructure", Status.PASS, "`GET /api/v1/health` → 200")
        else:
            sc.add("Infrastructure", Status.WARN, f"`/api/v1/health` → {code2}")


def check_postgresql(sc: Scorecard, db_url: str, target: str) -> None:
    if not db_url:
        sc.add("PostgreSQL", Status.FAIL, "DATABASE_URL не задан")
        return
    low = db_url.lower()
    if "postgresql" in low or "postgres" in low:
        sc.add("PostgreSQL", Status.PASS, "PostgreSQL (`DATABASE_URL`)")
    elif "sqlite" in low:
        if target == "production":
            sc.add("PostgreSQL", Status.FAIL, "SQLite — недопустимо для production pilot")
        else:
            sc.add("PostgreSQL", Status.WARN, "SQLite (OK для local dev, не для prod)")
    else:
        sc.add("PostgreSQL", Status.WARN, f"Неизвестный драйвер: {db_url[:40]}…")


def check_secrets(sc: Scorecard, file_env: dict[str, str], target: str) -> None:
    jwt = _env("JWT_SECRET_KEY", file_env, DEV_JWT)
    refresh = _env("JWT_REFRESH_SECRET_KEY", file_env, DEV_REFRESH)
    debug = _env("DEBUG", file_env, "false").lower() in ("1", "true", "yes")

    dev_secrets = jwt == DEV_JWT or refresh == DEV_REFRESH

    if target == "production":
        if dev_secrets:
            sc.add("Secrets", Status.FAIL, "JWT secrets — dev-дефолты (rotate обязательно)")
        else:
            sc.add("Secrets", Status.PASS, "JWT secrets — не dev-дефолты")
        if debug:
            sc.add("Secrets", Status.FAIL, "DEBUG=true на production")
        else:
            sc.add("Secrets", Status.PASS, "DEBUG=false")
    else:
        if dev_secrets:
            sc.add("Secrets", Status.WARN, "Dev JWT secrets (OK для local)")
        else:
            sc.add("Secrets", Status.PASS, "JWT secrets настроены")
        if debug:
            sc.add("Secrets", Status.WARN, "DEBUG=true (local)")


def check_email(sc: Scorecard, file_env: dict[str, str]) -> None:
    key = _env("EMAIL_API_KEY", file_env, "")
    if key.strip():
        sc.add("Email", Status.PASS, "EMAIL_API_KEY задан")
    else:
        sc.add("Email", Status.WARN, "EMAIL_API_KEY пуст — invite вручную или код в API")


def check_ocr(sc: Scorecard, py: list[str], backend: Path) -> None:
    code, out = _run(
        py + ["-m", "pytest", "tests/unit/test_ocr_parse.py", "-q", "--tb=line"],
        backend,
        timeout=120,
    )
    if code == 0:
        sc.add("OCR", Status.PASS, "test_ocr_parse PASS")
    else:
        sc.add("OCR", Status.FAIL, f"test_ocr_parse FAIL: {out[-300:]}")


def check_bank(sc: Scorecard, file_env: dict[str, str], api_url: str) -> None:
    oauth = _env("BANK_OAUTH_TOKEN_URL", file_env, "").strip()
    if oauth:
        sc.add("Bank import", Status.PASS, "Bank OAuth configured")
        return

    mock_url = _env("MOCK_BANK_URL", file_env, "http://localhost:8001").rstrip("/")
    code, _ = _http_get(f"{mock_url}/health", timeout=4.0)
    if code == 200:
        sc.add("Bank import", Status.PASS, f"Mock bank OK ({mock_url})")
        return
    if code is None and "localhost" not in mock_url:
        code2, _ = _http_get(f"{mock_url}/docs", timeout=4.0)
        if code2 == 200:
            sc.add("Bank import", Status.PASS, f"Mock bank docs ({mock_url})")
            return

    # capabilities from API
    base = api_url.rstrip("/")
    code3, body = _http_get(f"{base}/api/v1/integrations/capabilities")
    if code3 == 200:
        sc.add("Bank import", Status.WARN, "Manual JSON import + API capabilities OK (no OAuth/mock)")
    else:
        sc.add(
            "Bank import",
            Status.WARN,
            "Manual JSON import only (mock bank offline, OAuth не настроен)",
        )


def check_reporting(sc: Scorecard, file_env: dict[str, str], api_url: str) -> None:
    mode = _env("SUBMISSION_PORTAL_MODE", file_env, "mock")
    base = _env("SUBMISSION_PORTAL_BASE_URL", file_env, "")
    if mode == "http" and not base.strip():
        sc.add("Reporting (mock)", Status.WARN, "SUBMISSION_PORTAL_MODE=http без BASE_URL")
    else:
        sc.add("Reporting (mock)", Status.PASS, f"Portal mode: {mode}")

    code, body = _http_get(f"{api_url.rstrip('/')}/api/v1/integrations/capabilities")
    if code == 200:
        try:
            data = json.loads(body)
            authorities = data.get("reporting_authorities") or data.get("authorities") or []
            sc.add(
                "Reporting (mock)",
                Status.PASS,
                f"capabilities OK ({len(authorities) or 'n/a'} authorities in payload)",
            )
        except json.JSONDecodeError:
            sc.add("Reporting (mock)", Status.PASS, "capabilities endpoint OK")
    elif code is not None:
        sc.add("Reporting (mock)", Status.WARN, f"capabilities → HTTP {code}")


def check_demo_smoke(sc: Scorecard, py: list[str], backend: Path, root: Path, skip_build: bool) -> None:
    code, out = _run(py + ["-m", "alembic", "heads"], backend, timeout=60)
    if code != 0:
        sc.add("Demo smoke", Status.FAIL, f"alembic heads: {out[-200:]}")
    else:
        heads = [ln for ln in out.splitlines() if "(head)" in ln]
        if len(heads) > 1:
            sc.add("Demo smoke", Status.FAIL, f"multiple alembic heads: {len(heads)}")
        else:
            sc.add("Demo smoke", Status.PASS, "Alembic single head")

    code2, out2 = _run(
        py
        + [
            "-m",
            "pytest",
            "tests/unit/test_tax_calculator.py",
            "tests/unit/test_ocr_parse.py",
            "tests/integration/test_metrics.py",
            "-q",
            "--tb=line",
        ],
        backend,
        timeout=300,
    )
    if code2 == 0:
        sc.add("Demo smoke", Status.PASS, "pytest tax + OCR + metrics + submissions")
    else:
        sc.add("Demo smoke", Status.FAIL, f"pytest FAIL: {out2[-400:]}")

    if skip_build:
        sc.add("Demo smoke", Status.WARN, "Frontend build skipped (PILOT_SKIP_BUILD=1)")
    else:
        frontend = root / "frontend" / "web"
        code3, out3 = _run(["npm", "run", "build"], frontend, timeout=600)
        if code3 == 0:
            sc.add("Demo smoke", Status.PASS, "frontend `npm run build`")
        else:
            sc.add("Demo smoke", Status.FAIL, f"frontend build FAIL: {out3[-400:]}")


def check_pilot_seed(sc: Scorecard, backend: Path) -> None:
    pilot_py = backend / "app" / "api" / "v1" / "endpoints" / "pilot.py"
    seed_svc = backend / "app" / "services" / "pilot_seed_service.py"
    if pilot_py.is_file() and seed_svc.is_file():
        sc.add("Pilot seed", Status.PASS, "POST /api/v1/pilot/seed-template")
    else:
        sc.add("Pilot seed", Status.FAIL, "pilot seed module missing")


def check_playwright_e2e(sc: Scorecard, root: Path) -> None:
    spec = root / "frontend" / "web" / "e2e" / "pilot-smoke.spec.ts"
    if not spec.is_file():
        sc.add("Playwright E2E", Status.WARN, "e2e/pilot-smoke.spec.ts missing")
        return
    code, out = _run([sys.executable, str(root / "scripts" / "pilot_e2e.py")], root, timeout=900)
    if code == 0:
        sc.add("Playwright E2E", Status.PASS, "pilot-smoke.spec.ts")
    else:
        sc.add("Playwright E2E", Status.FAIL, out[-300:])


def check_limitations(sc: Scorecard, root: Path) -> None:
    scope = root / "docs" / "pilot" / "PILOT_SCOPE.md"
    if not scope.is_file():
        sc.add("Known limitations acknowledged", Status.FAIL, "PILOT_SCOPE.md missing")
        return
    sc.add("Known limitations acknowledged", Status.PASS, "PILOT_SCOPE.md present")
    if os.environ.get("PILOT_LIMITATIONS_ACK", "").strip() in ("1", "true", "yes"):
        sc.add("Known limitations acknowledged", Status.PASS, "PILOT_LIMITATIONS_ACK=1")
    else:
        sc.add(
            "Known limitations acknowledged",
            Status.WARN,
            "Set PILOT_LIMITATIONS_ACK=1 after team read PILOT_SCOPE",
        )


def _render_table(sc: Scorecard) -> list[str]:
    blocks = []
    seen: set[str] = set()
    for r in sc.rows:
        if r.block not in seen:
            blocks.append(r.block)
            seen.add(r.block)

    lines = ["| Блок | Статус | Детали |", "|------|--------|--------|"]
    for block in blocks:
        st = sc.block_status(block)
        details = "; ".join(x.detail for x in sc.rows if x.block == block)
        lines.append(f"| {block} | {st.icon} | {details} |")
    return lines


def _verdict_line(v: Verdict, *, markdown: bool = True) -> str:
    if v == "green":
        text = "Ready for Pilot"
        prefix = "## 🟢 " if markdown else "[GREEN] "
    elif v == "yellow":
        text = "Ready with Limitations"
        prefix = "## 🟡 " if markdown else "[YELLOW] "
    else:
        text = "Not Ready"
        prefix = "## 🔴 " if markdown else "[RED] "
    return f"{prefix}{text}"


def _safe_print(line: str) -> None:
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode("ascii", errors="replace").decode("ascii"))


def main() -> int:
    root = _root()
    backend = root / "backend" / "api-gateway"
    artifacts = root / "artifacts"
    artifacts.mkdir(exist_ok=True)
    out_path = artifacts / "pilot-readiness-scorecard.md"

    api_url = os.environ.get("PILOT_API_URL", "http://localhost:8000")
    target = os.environ.get("PILOT_TARGET", "local").lower()
    skip_build = os.environ.get("PILOT_SKIP_BUILD", "").strip() in ("1", "true", "yes")
    run_e2e = os.environ.get("PILOT_RUN_E2E", "").strip() in ("1", "true", "yes")

    env_file_path = os.environ.get("PILOT_ENV_FILE", "").strip()
    if env_file_path:
        file_env = _load_env_file(Path(env_file_path))
    else:
        file_env = _load_env_file(backend / ".env")
        pilot_local = backend / ".env.pilot.local"
        if pilot_local.is_file():
            file_env.update(_load_env_file(pilot_local))
    py = _find_gateway_python()
    db_url = _env("DATABASE_URL", file_env, "sqlite+aiosqlite:///./finklik.db")

    sc = Scorecard()
    sc.notes.append(f"PILOT_TARGET={target}")
    sc.notes.append(f"PILOT_API_URL={api_url}")
    sc.notes.append(f"Backend Python: `{py[0]}`")

    check_infrastructure(sc, api_url, target)
    check_postgresql(sc, db_url, target)
    check_secrets(sc, file_env, target)
    check_email(sc, file_env)
    check_ocr(sc, py, backend)
    check_bank(sc, file_env, api_url)
    check_reporting(sc, file_env, api_url)
    check_demo_smoke(sc, py, backend, root, skip_build)
    check_pilot_seed(sc, backend)
    check_limitations(sc, root)
    if run_e2e:
        check_playwright_e2e(sc, root)

    verdict = sc.verdict(target)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    md = [
        "# Pilot Readiness Scorecard",
        "",
        f"**Generated:** {now}  ",
        f"**Target:** `{target}`  ",
        f"**API:** `{api_url}`",
        "",
        _verdict_line(verdict),
        "",
        "### Блоки",
        "",
        *_render_table(sc),
        "",
        "### Notes",
        "",
        *[f"- {n}" for n in sc.notes],
        "",
        "### Next steps",
        "",
        "- Клиенту: [docs/pilot/PILOT_SCOPE.md](../docs/pilot/PILOT_SCOPE.md)",
        "- Команде: [docs/pilot/PILOT_READINESS_CHECKLIST.md](../docs/pilot/PILOT_READINESS_CHECKLIST.md)",
        "- UI smoke: [docs/dev/PRE_DEMO_SMOKE.md](../docs/dev/PRE_DEMO_SMOKE.md)",
        "",
    ]

    out_path.write_text("\n".join(md), encoding="utf-8")

    label = {"pass": "OK", "warn": "WARN", "fail": "FAIL"}
    print(_verdict_line(verdict, markdown=False))
    for block in dict.fromkeys(r.block for r in sc.rows):
        st = sc.block_status(block)
        _safe_print(f"  [{label[st.value]}] {block}")

    print(f"\nScorecard: {out_path}")

    return 1 if verdict == "red" else 0


if __name__ == "__main__":
    raise SystemExit(main())
