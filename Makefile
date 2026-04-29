.PHONY: dev stop migrate test lint security clean logs help bootstrap demo-smoke smoke-stage8 alembic-heads verify-pre-release verify-like-ci verify-like-ci-script typecheck-web test-autopilot-regression

# Windows Store / Git Bash: часто есть только `python`; CI/Linux обычно — `python3`.
ifeq ($(OS),Windows_NT)
PYTHON ?= python
else
PYTHON ?= python3
endif
COMPOSE = docker compose -f infrastructure/docker/docker-compose.dev.yml

help: ## Показать все команды
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Быстрый старт: make bootstrap && make dev"

bootstrap: ## Первоначальная настройка (запустить один раз)
	@bash scripts/bootstrap.sh

dev: ## Поднять всё DEV окружение
	@echo "🚀 Запускаем ФинКлик DEV..."
	$(COMPOSE) up -d
	@echo ""
	@echo "✅ Готово!"
	@echo "   Дашборд:   http://localhost:5173"
	@echo "   API Docs:  http://localhost:8000/docs"
	@echo "   Mock Банк: http://localhost:8001/docs"
	@echo "   Mock 1С:   http://localhost:8002/docs"

stop: ## Остановить все сервисы
	$(COMPOSE) down

restart: ## Перезапустить конкретный сервис (make restart SVC=backend)
	$(COMPOSE) restart $(SVC)

logs: ## Логи сервисов (make logs SVC=backend)
	$(COMPOSE) logs -f $(SVC)

migrate: ## Применить миграции БД
	@echo "📦 Применяем миграции..."
	cd backend/api-gateway && $(PYTHON) -m alembic upgrade head || \
	  $(PYTHON) -c "import asyncio; from app.core.database import engine, Base; import app.models; asyncio.run(engine.begin().__aenter__().__aexit__(None,None,None))"
	@echo "✅ Миграции применены"

alembic-heads: ## Показать head-ревизии Alembic (api-gateway)
	cd backend/api-gateway && $(PYTHON) -m alembic heads

verify-pre-release: ## Alembic heads + unit tests (api-gateway)
	cd backend/api-gateway && $(PYTHON) -m alembic heads && $(PYTHON) -m pytest tests/unit/ -q --tb=no

verify-like-ci: ## Как job backend-tests в .github/workflows/ci.yml (рекомендуется Python 3.11 + pip install -r requirements-dev.txt)
	cd backend/api-gateway && $(PYTHON) -m alembic heads && $(PYTHON) -m pytest tests/unit/ -v --tb=short && $(PYTHON) -m pytest tests/integration/test_metrics.py tests/integration/test_submissions.py tests/integration/test_scanner.py -v --tb=short

verify-like-ci-script: ## Тот же набор через scripts/verify_like_ci.py (автовыбор .venv311 при наличии)
	@$(PYTHON) scripts/verify_like_ci.py

typecheck-web: ## TypeScript без сборки (npm run typecheck)
	cd frontend/web && npm run typecheck

seed: ## Загрузить тестовые данные
	@echo "🌱 Загружаем тестовые данные..."
	$(PYTHON) scripts/generate_test_data.py --count 10
	@echo "✅ Тестовые данные загружены"

test: ## Запустить все тесты
	@bash scripts/run_all_tests.sh

test-unit: ## Только юнит-тесты
	cd backend/api-gateway && $(PYTHON) -m pytest tests/unit/ -v --tb=short

test-integration: ## Только интеграционные тесты
	cd backend/api-gateway && $(PYTHON) -m pytest tests/integration/ -v --tb=short

test-autopilot-regression: ## Регрессия автопилота: ключевые E2E/integration цепочки
	cd backend/api-gateway && $(PYTHON) -m pytest tests/integration/test_automation_pipeline.py tests/integration/test_onec_sync_smoke.py tests/integration/test_scanner.py -v --tb=short

demo-smoke: ## Быстрый pre-demo smoke (backend+frontend)
	@$(PYTHON) scripts/pre_demo_smoke.py

smoke-stage8: ## Smoke stage8 (RBAC manager + planner/KUDiR/OAuth + frontend build)
	@$(PYTHON) scripts/smoke_stage8.py

test-load: ## Нагрузочное тестирование (1000 клиентов)
	@echo "⚡ Запускаем нагрузочный тест..."
	$(PYTHON) scripts/load_test.py --users 1000 --duration 60

lint: ## Проверка кода (flake8, mypy, eslint)
	@echo "🔍 Линтинг Python..."
	cd backend/api-gateway && $(PYTHON) -m flake8 app/ --max-line-length=120 --exclude=__pycache__ || true
	@echo "🔍 TypeScript (tsc --noEmit)..."
	cd frontend/web && npm run typecheck
	@echo "✅ Линтинг завершён"

security: ## Проверка безопасности
	@bash scripts/security_audit.sh

format: ## Форматирование кода
	cd backend/api-gateway && $(PYTHON) -m black app/ --line-length=120 || true
	cd frontend/web && npx prettier --write src/ || true

clean: ## Очистить временные файлы
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	$(COMPOSE) down -v --remove-orphans 2>/dev/null || true
	@echo "✅ Очищено"

ps: ## Статус сервисов
	$(COMPOSE) ps

env: ## Сгенерировать .env файл
	@bash scripts/bootstrap.sh --env-only
