"""
Общая подготовка окружения для всех тестов.

Важно: не импортировать app.main здесь — иначе приложение поднимется до установки
DISABLE_RATE_LIMIT и других переменных (интеграционные тесты в отдельном процессе CI).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key_12345678901234567890")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test_refresh_key_12345678901234567890")
os.environ["DISABLE_RATE_LIMIT"] = "1"
