#!/usr/bin/env bash
# Быстрая проверка перед релизом: граф Alembic + юнит-тесты API.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend/api-gateway"
python -m alembic heads
python -m pytest tests/unit/ -q --tb=no
