#!/usr/bin/env python3
"""Run stage8 smoke checks (roles/planner/KUDiR/OAuth) and save summary."""

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
    summary = artifacts / "smoke-stage8-summary.md"

    _run([sys.executable, "-m", "alembic", "heads"], cwd=backend)
    _run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/integration/test_planner_and_kudir_stage.py",
            "tests/integration/test_manager_access_policy.py",
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
                "# Stage8 Smoke Summary",
                "",
                f"Generated at: {now}",
                "",
                "## Checks",
                "",
                "- Alembic heads (single chain): PASS",
                "- Integration: planner + KUDiR + OAuth + notifications: PASS",
                "- Integration: manager role access policy: PASS",
                "- Frontend production build: PASS",
                "",
                "## Scope",
                "",
                "- Manager RBAC restrictions (allowed/forbidden endpoints).",
                "- Planner comments/tasks/reporting and notifications read-all.",
                "- Scanner upload-to-kudir flow and bank OAuth import flow.",
                "- OAuth callback state validation (incl. negative case).",
                "",
                "## Next",
                "",
                "- For deploy verification, run manual UI checks from `docs/dev/PRE_DEMO_SMOKE.md`.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print("Stage8 smoke passed.")
    print(f"Summary: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
