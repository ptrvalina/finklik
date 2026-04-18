#!/usr/bin/env python3
"""
Локальный аналог job «Backend Tests» в .github/workflows/ci.yml:
alembic heads → unit → integration (metrics, submissions, scanner).

Отдельно в CI: job «NBRB FX Smoke» — tests/integration/test_fx_nbrb_live.py (исходящий HTTPS к www.nbrb.by).

Выбор интерпретатора:
  1) backend/api-gateway/.venv311/ (Windows/Linux)
  2) переменная окружения PYTHON_EXE
  3) sys.executable
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def _find_gateway_python() -> list[str]:
    root = Path(__file__).resolve().parent.parent
    gw = root / "backend" / "api-gateway"
    env = os.environ.get("PYTHON_EXE", "").strip()
    if env:
        return [env]
    for rel in (".venv311/Scripts/python.exe", ".venv311/bin/python", ".venv/Scripts/python.exe", ".venv/bin/python"):
        p = gw / rel
        if p.is_file():
            return [str(p)]
    return [sys.executable]


def _run(py: list[str], args: list[str], cwd: Path) -> None:
    cmd = py + args
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=str(cwd), check=True)


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    gw = root / "backend" / "api-gateway"
    py = _find_gateway_python()

    _run(py, ["-m", "alembic", "heads"], gw)
    _run(py, ["-m", "pytest", "tests/unit/", "-v", "--tb=short"], gw)
    _run(
        py,
        [
            "-m",
            "pytest",
            "tests/integration/test_metrics.py",
            "tests/integration/test_submissions.py",
            "tests/integration/test_scanner.py",
            "-v",
            "--tb=short",
        ],
        gw,
    )
    print("verify-like-ci: OK", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
