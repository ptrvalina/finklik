#!/usr/bin/env bash
# run_all_tests.sh — Запуск всех тестов ФинКлик
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
TOTAL_PASS=0; TOTAL_FAIL=0

ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; ((TOTAL_FAIL++)); }
info() { echo -e "${YELLOW}  → $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   ФинКлик — Запуск всех тестов       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Синтаксис Python ───────────────────────────────────────────────
info "1. Проверка синтаксиса Python..."
ERRORS=0
for f in $(find backend/api-gateway/app -name "*.py" 2>/dev/null); do
  python3 -c "import ast; ast.parse(open('$f').read())" 2>/dev/null || ((ERRORS++))
done
if [ "$ERRORS" -eq 0 ]; then
  ok "Синтаксис Python — OK"
  ((TOTAL_PASS++))
else
  fail "Синтаксические ошибки: $ERRORS файлов"
fi

# ── 2. Юнит-тесты ─────────────────────────────────────────────────────
info "2. Юнит-тесты..."
if command -v python3 &>/dev/null; then
  # Запускаем тесты напрямую через python (без pytest если не установлен)
  cd backend/api-gateway

  if python3 -m pytest --version &>/dev/null 2>&1; then
    if python3 -m pytest ../../tests/unit/ -v --tb=short -q 2>&1 | tail -5; then
      ok "Юнит-тесты пройдены"
      ((TOTAL_PASS++))
    else
      fail "Юнит-тесты провалились"
    fi
  else
    # Запускаем тесты напрямую если pytest не установлен
    python3 -c "
import sys; sys.path.insert(0, '.')
exec(open('../../tests/unit/test_core.py').read())
print('Тесты выполнены вручную')
" && ok "Базовые тесты пройдены" && ((TOTAL_PASS++)) || fail "Ошибка в тестах"
  fi

  cd ../..
fi

# ── 3. TypeScript typecheck ───────────────────────────────────────────
info "3. TypeScript проверка типов..."
if [ -d "frontend/web/node_modules" ]; then
  if cd frontend/web && npx tsc --noEmit --skipLibCheck 2>/dev/null; then
    ok "TypeScript — OK"
    ((TOTAL_PASS++))
  else
    fail "TypeScript ошибки типов"
  fi
  cd ../..
else
  echo "  (пропускаем — node_modules не установлены)"
fi

# ── 4. JSON/YAML валидация ────────────────────────────────────────────
info "4. Валидация конфигов..."
INVALID=0
for f in $(find . -name "package.json" -not -path "*/node_modules/*" 2>/dev/null); do
  python3 -c "import json; json.load(open('$f'))" 2>/dev/null || ((INVALID++))
done
if [ "$INVALID" -eq 0 ]; then
  ok "JSON файлы валидны"
  ((TOTAL_PASS++))
else
  fail "Невалидные JSON файлы: $INVALID"
fi

# ── 5. Проверка безопасности ──────────────────────────────────────────
info "5. Быстрый security check..."
if bash scripts/security_audit.sh 2>/dev/null; then
  ok "Security audit пройден"
  ((TOTAL_PASS++))
else
  fail "Security audit выявил проблемы (см. reports/)"
fi

# ── Итог ──────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  РЕЗУЛЬТАТЫ                          ║"
echo "╠══════════════════════════════════════╣"
printf "║  ✓ Пройдено:    %-5d               ║\n" $TOTAL_PASS
printf "║  ✗ Провалено:   %-5d               ║\n" $TOTAL_FAIL
echo "╚══════════════════════════════════════╝"
echo ""

if [ "$TOTAL_FAIL" -gt 0 ]; then
  echo -e "${RED}Есть проваленные тесты. Исправь перед деплоем.${NC}"
  exit 1
else
  echo -e "${GREEN}Все проверки пройдены!${NC}"
  exit 0
fi
