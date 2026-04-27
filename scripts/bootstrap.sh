#!/usr/bin/env bash
# bootstrap.sh — Первоначальная настройка DEV окружения ФинКлик
# Запуск: bash scripts/bootstrap.sh

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   ФинКлик — DEV Bootstrap            ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Проверка зависимостей ─────────────────────────────────────────────
echo "→ Проверяем зависимости..."

command -v python3 >/dev/null 2>&1 && ok "Python $(python3 --version | cut -d' ' -f2)" || fail "Python 3 не найден. Установи с python.org"
command -v node   >/dev/null 2>&1 && ok "Node.js $(node --version)" || fail "Node.js не найден. Установи с nodejs.org"
command -v npm    >/dev/null 2>&1 && ok "npm $(npm --version)" || warn "npm не найден"
command -v docker >/dev/null 2>&1 && ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')" || warn "Docker не найден — нужен для make dev"
command -v git    >/dev/null 2>&1 && ok "Git $(git --version | cut -d' ' -f3)" || warn "Git не найден"

# ── Генерация .env ────────────────────────────────────────────────────
ENV_FILE="backend/api-gateway/.env"

if [ ! -f "$ENV_FILE" ] || [ "$1" = "--env-only" ]; then
  echo ""
  echo "→ Генерируем .env файл..."

  SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  REFRESH=$(python3 -c "import secrets; print(secrets.token_hex(32))")

  cat > "$ENV_FILE" << EOF
# ФинКлик — DEV конфигурация
# Сгенерировано: $(date)

DATABASE_URL=sqlite+aiosqlite:///./finklik.db
REDIS_URL=redis://localhost:6379/0

JWT_SECRET_KEY=${SECRET}
JWT_REFRESH_SECRET_KEY=${REFRESH}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

MOCK_BANK_URL=http://localhost:8001
ONEC_MOCK_URL=http://localhost:8002

DEBUG=true
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
EOF

  ok ".env создан → $ENV_FILE"
else
  ok ".env уже существует"
fi

# ── Python виртуальное окружение ──────────────────────────────────────
echo ""
echo "→ Настраиваем Python..."

VENV="backend/api-gateway/venv"
if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
  ok "venv создан"
else
  ok "venv уже существует"
fi

source "$VENV/bin/activate"
pip install -q -r backend/api-gateway/requirements.txt
pip install -q -r backend/api-gateway/requirements-dev.txt
ok "Python зависимости установлены (включая dev: flake8, pytest, …)"

# ── Frontend зависимости ──────────────────────────────────────────────
echo ""
echo "→ Настраиваем Frontend..."

if [ ! -d "frontend/web/node_modules" ]; then
  cd frontend/web && npm install --silent && cd ../..
  ok "npm зависимости установлены"
else
  ok "node_modules уже существует"
fi

# ── Pre-commit hooks ──────────────────────────────────────────────────
echo ""
echo "→ Настраиваем git hooks..."

if [ -d ".git" ]; then
  cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
# Pre-commit: быстрая проверка перед коммитом
echo "→ Pre-commit проверки..."
cd backend/api-gateway
python3 -m py_compile app/**/*.py 2>/dev/null && echo "  ✓ Python синтаксис OK" || exit 1
HOOK
  chmod +x .git/hooks/pre-commit
  ok "pre-commit hook установлен"
else
  warn "Не git репозиторий — пропускаем hooks"
fi

# ── Финал ─────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ Bootstrap завершён!              ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "  Следующие шаги:"
echo "  1. make dev       — поднять все сервисы"
echo "  2. make seed      — загрузить тестовые данные"
echo "  3. make test      — запустить тесты"
echo ""
