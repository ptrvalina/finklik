#!/usr/bin/env python3
"""Production readiness verification (run before deploy)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def _gw_python() -> list[str]:
    root = Path(__file__).resolve().parent.parent
    gw = root / "backend" / "api-gateway"
    env = os.environ.get("PYTHON_EXE", "").strip()
    if env:
        return [env]
    for rel in (".venv311/Scripts/python.exe", ".venv311/bin/python"):
        p = gw / rel
        if p.is_file():
            return [str(p)]
    return [sys.executable]


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    backend = root / "backend" / "api-gateway"
    py = _gw_python()
    failures: list[str] = []

    def run_check(name: str, cmd: list[str], cwd: Path) -> None:
        print(f"→ {name}")
        r = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True)
        if r.returncode != 0:
            failures.append(name)
            print(r.stdout or r.stderr)
        else:
            print("  OK")

    run_check("alembic heads", py + ["-m", "alembic", "heads"], backend)
    run_check("compileall", py + ["-m", "compileall", "app", "-q"], backend)

    chart = backend / "app" / "data" / "chart_of_accounts_rb.json"
    if chart.is_file():
        data = json.loads(chart.read_text(encoding="utf-8"))
        n = len(data.get("accounts", []))
        print(f"→ chart_of_accounts_rb.json ({n} accounts)")
        if n < 40:
            failures.append("chart_accounts_count")
            print("  WARN: expected expanded chart for pilot")
    else:
        failures.append("chart_json")
        print("  FAIL: missing chart JSON")

    oked = backend / "app" / "data" / "oked_seed_popular.json"
    print(f"→ oked seed: {'OK' if oked.is_file() else 'MISSING'}")

    run_check(
        "unit integrity",
        py + ["-m", "pytest", "tests/unit/test_ledger_engine.py", "-q", "--tb=short"],
        backend,
    )

    if failures:
        print("\nFAILED:", ", ".join(failures))
        return 1
    print("\nAll production verify checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
