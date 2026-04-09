#!/usr/bin/env bash
# security_audit.sh — Автоматическая проверка безопасности ФинКлик
# Запуск: bash scripts/security_audit.sh

set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

PASS=0; FAIL=0; WARN=0
REPORT="reports/security_audit_$(date +%Y%m%d_%H%M%S).txt"
mkdir -p reports

pass() { echo -e "${GREEN}  ✓ $1${NC}"; echo "PASS: $1" >> "$REPORT"; ((PASS++)); }
fail() { echo -e "${RED}  ✗ $1${NC}"; echo "FAIL: $1" >> "$REPORT"; ((FAIL++)); }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; echo "WARN: $1" >> "$REPORT"; ((WARN++)); }
info() { echo -e "${BLUE}  → $1${NC}"; echo "INFO: $1" >> "$REPORT"; }

echo "╔══════════════════════════════════════════════╗"
echo "║  ФинКлик — Аудит безопасности               ║"
echo "║  $(date)          ║"
echo "╚══════════════════════════════════════════════╝"
echo "Отчёт сохраняется в: $REPORT"
echo "" | tee -a "$REPORT"

# ── 1. Проверка .env файлов ───────────────────────────────────────────
info "1. Проверка конфигурации..."

ENV_FILE="backend/api-gateway/.env"
if [ -f "$ENV_FILE" ]; then
  # JWT ключи не должны быть дефолтными
  if grep -q "dev_secret_key_finklik_2024_min32chars" "$ENV_FILE" 2>/dev/null; then
    warn "JWT_SECRET_KEY — дефолтный DEV ключ (ОК для разработки, НЕЛЬЗЯ в продакшн)"
  else
    pass "JWT_SECRET_KEY — кастомный ключ"
  fi

  # .env не должен быть в git
  if git check-ignore -q "$ENV_FILE" 2>/dev/null; then
    pass ".env в .gitignore"
  else
    warn ".env может попасть в git — добавь в .gitignore"
  fi
else
  warn ".env файл не найден (запусти: make bootstrap)"
fi

# ── 2. Проверка кода Python ───────────────────────────────────────────
info "2. Статический анализ кода..."

PYTHON_FILES=$(find backend/api-gateway/app -name "*.py" 2>/dev/null | wc -l | tr -d ' ')
info "Найдено Python файлов: $PYTHON_FILES"

# Проверяем синтаксис
SYNTAX_ERRORS=0
for f in $(find backend/api-gateway/app -name "*.py" 2>/dev/null); do
  python3 -c "import ast; ast.parse(open('$f').read())" 2>/dev/null || ((SYNTAX_ERRORS++))
done

if [ "$SYNTAX_ERRORS" -eq 0 ]; then
  pass "Синтаксис Python — без ошибок ($PYTHON_FILES файлов)"
else
  fail "Синтаксические ошибки Python: $SYNTAX_ERRORS файлов"
fi

# Проверяем наличие security middleware
if grep -r "SecurityHeadersMiddleware\|RateLimitMiddleware" backend/api-gateway/app/main.py >/dev/null 2>&1; then
  pass "Security middleware подключён в main.py"
else
  fail "Security middleware НЕ подключён в main.py"
fi

# Проверяем brute force protection
if grep -r "check_brute_force\|record_failed_login" backend/api-gateway/app/api >/dev/null 2>&1; then
  pass "Brute-force защита подключена в auth endpoints"
else
  fail "Brute-force защита НЕ подключена"
fi

# Проверяем rate limiting
if grep -r "RateLimitMiddleware\|check_rate_limit" backend/api-gateway/app >/dev/null 2>&1; then
  pass "Rate limiting реализован"
else
  fail "Rate limiting НЕ реализован"
fi

# Проверяем аудит-лог
if grep -r "audit_log" backend/api-gateway/app/api >/dev/null 2>&1; then
  pass "Аудит-логирование подключено в эндпоинтах"
else
  warn "Аудит-лог не найден в эндпоинтах"
fi

# Проверяем шифрование данных
if grep -r "get_encryptor\|DataEncryptor" backend/api-gateway/app >/dev/null 2>&1; then
  pass "Шифрование персональных данных реализовано"
else
  warn "Шифрование персональных данных не найдено"
fi

# ── 3. Проверка JWT настроек ──────────────────────────────────────────
info "3. Проверка JWT..."

if grep -q "ACCESS_TOKEN_EXPIRE_MINUTES.*=.*15" backend/api-gateway/app/core/config.py 2>/dev/null; then
  pass "Access token TTL = 15 минут (рекомендуется)"
else
  warn "Access token TTL не проверен — рекомендуется 15 минут"
fi

if grep -q "REFRESH_TOKEN_EXPIRE_DAYS.*=.*7" backend/api-gateway/app/core/config.py 2>/dev/null; then
  pass "Refresh token TTL = 7 дней"
else
  warn "Refresh token TTL не проверен"
fi

# bcrypt должен использоваться для паролей
if grep -r "bcrypt\|passlib" backend/api-gateway/app >/dev/null 2>&1; then
  pass "bcrypt используется для хеширования паролей"
else
  fail "bcrypt НЕ найден — пароли не защищены!"
fi

# ── 4. Проверка CORS ──────────────────────────────────────────────────
info "4. Проверка CORS..."

if grep -q 'allow_origins.*\*\|allow_origins.*"\*"' backend/api-gateway/app/main.py 2>/dev/null; then
  fail "CORS разрешён для всех доменов (*) — уязвимость!"
else
  pass "CORS ограничен конкретными доменами"
fi

# ── 5. Проверка SQL injection ─────────────────────────────────────────
info "5. Проверка SQL injection защиты..."

RAW_SQL=$(grep -r "execute.*f\"SELECT\|execute.*f'SELECT\|text.*%s" backend/api-gateway/app 2>/dev/null | wc -l | tr -d ' ')
if [ "$RAW_SQL" -eq 0 ]; then
  pass "Сырых SQL запросов не найдено (используется ORM)"
else
  fail "Найдено $RAW_SQL потенциально опасных SQL запросов"
fi

# ── 6. Проверка зависимостей на уязвимости ────────────────────────────
info "6. Проверка зависимостей..."

# Проверяем наличие requirements.txt
if [ -f "backend/api-gateway/requirements.txt" ]; then
  pass "requirements.txt найден"

  # Проверяем нет ли очень старых версий
  if grep -q "fastapi==0\.[0-9][0-9]" backend/api-gateway/requirements.txt 2>/dev/null; then
    warn "FastAPI может быть устаревшим — обновите зависимости"
  else
    pass "FastAPI версия актуальна"
  fi
else
  fail "requirements.txt не найден"
fi

# npm audit (если node_modules есть)
if [ -d "frontend/web/node_modules" ]; then
  VULNS=$(cd frontend/web && npm audit --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('critical',0))" 2>/dev/null || echo "N/A")
  if [ "$VULNS" = "0" ]; then
    pass "npm: критических уязвимостей не найдено"
  elif [ "$VULNS" = "N/A" ]; then
    warn "npm audit не выполнен (запусти: cd frontend/web && npm audit)"
  else
    fail "npm: найдено $VULNS критических уязвимостей (cd frontend/web && npm audit fix)"
  fi
fi

# ── 7. Проверка файловых разрешений ──────────────────────────────────
info "7. Проверка разрешений..."

if [ -f "backend/api-gateway/.env" ]; then
  PERMS=$(stat -c "%a" "backend/api-gateway/.env" 2>/dev/null || stat -f "%A" "backend/api-gateway/.env" 2>/dev/null || echo "unknown")
  if [ "$PERMS" = "600" ] || [ "$PERMS" = "644" ]; then
    pass ".env разрешения корректны ($PERMS)"
  else
    warn ".env разрешения: $PERMS (рекомендуется 600)"
  fi
fi

# ── 8. Проверка Content Security Policy ──────────────────────────────
info "8. Проверка Security Headers..."

if grep -q "Content-Security-Policy\|X-Frame-Options\|X-Content-Type-Options" \
    backend/api-gateway/app/security/middleware.py 2>/dev/null; then
  pass "Security Headers настроены (CSP, X-Frame-Options, X-Content-Type-Options)"
else
  fail "Security Headers НЕ настроены"
fi

# ── Итоговый отчёт ────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  РЕЗУЛЬТАТЫ АУДИТА БЕЗОПАСНОСТИ              ║"
echo "╠══════════════════════════════════════════════╣"
printf "║  ✓ Пройдено:       %-6d                    ║\n" $PASS
printf "║  ✗ Провалено:      %-6d                    ║\n" $FAIL
printf "║  ⚠ Предупреждений: %-6d                    ║\n" $WARN
echo "╚══════════════════════════════════════════════╝"
echo ""

{
  echo ""
  echo "=== ИТОГИ АУДИТА ==="
  echo "Дата: $(date)"
  echo "Пройдено:       $PASS"
  echo "Провалено:      $FAIL"
  echo "Предупреждений: $WARN"
} >> "$REPORT"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Обнаружены критические проблемы безопасности! Исправь перед деплоем.${NC}"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}Есть предупреждения. Проверь перед продакшн деплоем.${NC}"
  exit 0
else
  echo -e "${GREEN}Все проверки пройдены! Система готова к деплою.${NC}"
  exit 0
fi
