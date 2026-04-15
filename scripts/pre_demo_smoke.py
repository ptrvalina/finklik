#!/usr/bin/env python3
"""Run quick pre-demo smoke checks and write a markdown summary."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def _run(cmd: list[str], cwd: Path) -> None:
    if sys.platform.startswith("win") and cmd and cmd[0] == "npm":
        cmd = ["npm.cmd", *cmd[1:]]
    subprocess.run(cmd, cwd=str(cwd), check=True)


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    backend = root / "backend" / "api-gateway"
    frontend = root / "frontend" / "web"
    artifacts = root / "artifacts"
    artifacts.mkdir(exist_ok=True)
    summary = artifacts / "pre-demo-smoke-summary.md"

    _run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/unit/test_tax_calculator.py",
            "tests/integration/test_metrics.py",
            "-q",
            "--tb=short",
        ],
        cwd=backend,
    )
    _run(["npm", "run", "build"], cwd=frontend)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    summary.write_text(
        "\n".join(
            [
                "# Pre-Demo Smoke Summary",
                "",
                f"Generated at: {now}",
                "",
                "## Checks",
                "",
                "- Backend unit/tax + metrics smoke: PASS",
                "- Frontend production build: PASS",
                "",
                "## Next",
                "",
                "- Open `docs/dev/PRE_DEMO_SMOKE.md` and complete UI/manual checks.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print("Pre-demo smoke passed.")
    print(f"Summary: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
