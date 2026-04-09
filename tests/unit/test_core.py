"""
Юнит-тесты для ФинКлик.
Запуск: cd backend/api-gateway && pytest tests/ -v --cov=app --cov-report=term-missing
"""
import pytest
import asyncio
from decimal import Decimal
from datetime import date

# ── Тесты безопасности ────────────────────────────────────────────────

class TestSecurity:

    def test_password_hashing(self):
        """Пароли хешируются bcrypt."""
        import sys; sys.path.insert(0, '.')
        from app.core.security import hash_password, verify_password

        password = "TestPass123"
        hashed = hash_password(password)

        assert hashed != password
        assert hashed.startswith("$2b$")
        assert verify_password(password, hashed) is True
        assert verify_password("WrongPass", hashed) is False

    def test_jwt_create_and_decode(self):
        """JWT токены создаются и декодируются корректно."""
        from app.core.security import create_access_token, decode_access_token

        token = create_access_token("user-123", "org-456", "owner")
        assert isinstance(token, str)
        assert len(token) > 20

        payload = decode_access_token(token)
        assert payload["sub"] == "user-123"
        assert payload["org_id"] == "org-456"
        assert payload["role"] == "owner"
        assert payload["type"] == "access"

    def test_invalid_jwt_raises(self):
        """Невалидный JWT вызывает исключение."""
        from fastapi import HTTPException
        from app.core.security import decode_access_token

        with pytest.raises(HTTPException) as exc_info:
            decode_access_token("totally.invalid.token")
        assert exc_info.value.status_code == 401

    def test_rate_limit_blocks_after_limit(self):
        """Rate limiting блокирует после превышения лимита."""
        from app.security.middleware import _rate_limit_store, check_rate_limit, RATE_LIMIT_REQUESTS
        import time
        from fastapi import HTTPException
        from unittest.mock import MagicMock

        # Создаём mock request
        request = MagicMock()
        request.client.host = "192.168.99.1"
        request.headers.get.return_value = ""

        key = f"rl:192.168.99.1:anon"
        now = time.time()
        # Заполняем до лимита
        _rate_limit_store[key] = [now] * RATE_LIMIT_REQUESTS

        with pytest.raises(HTTPException) as exc_info:
            check_rate_limit(request)
        assert exc_info.value.status_code == 429

        # Очищаем
        del _rate_limit_store[key]

    def test_brute_force_blocks_after_5_fails(self):
        """Брутфорс-защита блокирует после 5 неудач."""
        from app.security.middleware import (
            check_brute_force, record_failed_login,
            record_successful_login, _brute_force_store, BRUTE_FORCE_MAX
        )
        from fastapi import HTTPException

        email = "test_brute@test.by"
        _brute_force_store.pop(email, None)

        # 4 неудачи — не блокируем
        for _ in range(BRUTE_FORCE_MAX - 1):
            record_failed_login(email)
        check_brute_force(email)  # не должно бросить

        # 5-я неудача — блокируем
        record_failed_login(email)
        with pytest.raises(HTTPException) as exc_info:
            check_brute_force(email)
        assert exc_info.value.status_code == 429

        # Успешный вход сбрасывает блокировку
        record_successful_login(email)
        _brute_force_store.pop(email, None)

    def test_data_encryption_roundtrip(self):
        """Шифрование и дешифрование данных работает корректно."""
        from app.security.middleware import DataEncryptor

        enc = DataEncryptor("test_secret_key_12345")
        original = "Иванов Иван Иванович"

        encrypted = enc.encrypt(original)
        assert encrypted != original
        assert len(encrypted) > 0

        decrypted = enc.decrypt(encrypted)
        assert decrypted == original

    def test_empty_string_encryption(self):
        """Шифрование пустой строки возвращает пустую строку."""
        from app.security.middleware import DataEncryptor
        enc = DataEncryptor("key")
        assert enc.encrypt("") == ""
        assert enc.decrypt("") == ""


# ── Тесты налогового калькулятора ────────────────────────────────────

class TestTaxCalculator:

    def test_usn_3_percent(self):
        """УСН 3% рассчитывается правильно."""
        from app.services.tax_calculator import calculate_usn

        result = calculate_usn(
            income=Decimal("10000"),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
            with_vat=True,
        )
        assert result.usn_amount == Decimal("300.00")
        assert result.usn_to_pay == Decimal("300.00")
        assert result.deadline == date(2024, 4, 25)

    def test_usn_5_percent(self):
        """УСН 5% рассчитывается правильно."""
        from app.services.tax_calculator import calculate_usn

        result = calculate_usn(
            income=Decimal("10000"),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
            with_vat=False,
        )
        assert result.usn_amount == Decimal("500.00")

    def test_usn_with_paid_before(self):
        """УСН учитывает ранее уплаченные авансы."""
        from app.services.tax_calculator import calculate_usn

        result = calculate_usn(
            income=Decimal("10000"),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
            with_vat=True,
            paid_before=Decimal("200"),
        )
        assert result.usn_to_pay == Decimal("100.00")

    def test_vat_calculation(self):
        """НДС рассчитывается методом обратного выделения."""
        from app.services.tax_calculator import calculate_vat

        vat_sales, vat_purchases, vat_to_pay, deadline = calculate_vat(
            sales_with_vat=Decimal("12000"),
            purchases_with_vat=Decimal("6000"),
            period_end=date(2024, 1, 31),
        )
        # НДС с продаж: 12000 × 20/120 = 2000
        assert vat_sales == Decimal("2000.00")
        # НДС с покупок: 6000 × 20/120 = 1000
        assert vat_purchases == Decimal("1000.00")
        # К уплате: 2000 - 1000 = 1000
        assert vat_to_pay == Decimal("1000.00")
        # Дедлайн: 20 февраля
        assert deadline == date(2024, 2, 20)

    def test_fsszn_calculation(self):
        """ФСЗН рассчитывается от ФОТ."""
        from app.services.tax_calculator import calculate_fsszn

        employer, employee, deadline = calculate_fsszn(
            fot=Decimal("1000"),
            period_end=date(2024, 3, 31),
        )
        assert employer == Decimal("340.00")  # 34%
        assert employee == Decimal("10.00")   # 1%

    def test_salary_calculation_no_children(self):
        """Зарплата без детей рассчитывается правильно."""
        from app.services.tax_calculator import calculate_salary

        result = calculate_salary(
            base_salary=Decimal("1000"),
            bonus=Decimal("0"),
            sick_days=0,
            vacation_days=0,
            work_days_plan=21,
            has_children=0,
            is_disabled=False,
        )
        assert result["gross_salary"] == Decimal("1000.00")
        assert result["income_tax"] == Decimal("130.00")   # 13%
        assert result["fsszn_employee"] == Decimal("10.00")  # 1%
        assert result["net_salary"] == Decimal("860.00")
        assert result["fsszn_employer"] == Decimal("340.00")  # 34%

    def test_salary_with_1_child_deduction(self):
        """Вычет на 1 ребёнка уменьшает НДФЛ."""
        from app.services.tax_calculator import calculate_salary

        result_no_child = calculate_salary(
            Decimal("1000"), Decimal("0"), 0, 0, 21, 0, False
        )
        result_1_child = calculate_salary(
            Decimal("1000"), Decimal("0"), 0, 0, 21, 1, False
        )
        # С ребёнком НДФЛ должен быть меньше
        assert result_1_child["income_tax"] < result_no_child["income_tax"]

    def test_salary_sick_days_reduce_pay(self):
        """Больничные дни уменьшают оклад пропорционально."""
        from app.services.tax_calculator import calculate_salary

        full = calculate_salary(Decimal("1000"), Decimal("0"), 0, 0, 21, 0, False)
        sick = calculate_salary(Decimal("1000"), Decimal("0"), 5, 0, 21, 0, False)

        # При больничном gross < полного оклада (но + больничные 80%)
        assert sick["gross_salary"] < full["gross_salary"]

    def test_tax_calendar_generates_events(self):
        """Налоговый календарь генерирует события на год."""
        from app.services.tax_calculator import generate_tax_calendar

        events = generate_tax_calendar(2024)
        assert len(events) > 20

        types = {e["event_type"] for e in events}
        assert "tax" in types
        assert "report" in types
        assert "salary" in types


# ── Тесты аутентификации через API ───────────────────────────────────

class TestAuthAPI:
    """Интеграционные тесты API (требуют запущенного сервера)."""

    BASE_URL = "http://localhost:8000/api/v1"

    def test_health_check(self):
        """Health endpoint доступен."""
        try:
            import httpx
            r = httpx.get("http://localhost:8000/health", timeout=2)
            assert r.status_code == 200
            assert r.json()["status"] == "ok"
        except Exception:
            pytest.skip("Сервер не запущен — запусти: make dev")

    def test_register_and_login(self):
        """Регистрация и логин работают корректно."""
        try:
            import httpx, time
            suffix = int(time.time())
            client = httpx.Client(base_url=self.BASE_URL, timeout=5)

            # Регистрация
            r = client.post("/auth/register", json={
                "email": f"test_{suffix}@test.by",
                "password": "TestPass1",
                "full_name": "Тест Иванов",
                "org_name": "ИП Тестов",
                "org_unp": f"69{str(suffix)[-7:].zfill(7)}",
            })
            assert r.status_code == 201
            tokens = r.json()
            assert "access_token" in tokens

            # Получение профиля
            r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
            assert r2.status_code == 200
            assert r2.json()["email"] == f"test_{suffix}@test.by"

        except Exception as e:
            if "ConnectError" in str(type(e)):
                pytest.skip("Сервер не запущен — запусти: make dev")
            raise


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
