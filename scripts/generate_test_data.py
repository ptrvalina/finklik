#!/usr/bin/env python3
"""
generate_test_data.py — Генерация тестовых данных для нагрузочного тестирования.

Создаёт N тестовых организаций через API с транзакциями, сотрудниками.

Запуск:
  python3 scripts/generate_test_data.py --count 1000 --api http://localhost:8000
  python3 scripts/generate_test_data.py --count 10  # быстрый тест
"""
import argparse
import random
import json
import time
import sys
from datetime import date, timedelta
from decimal import Decimal

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

# ── Генераторы данных ─────────────────────────────────────────────────

FIRST_NAMES = ["Иван", "Пётр", "Сергей", "Алексей", "Дмитрий", "Андрей",
               "Николай", "Владимир", "Антон", "Михаил", "Ольга", "Наталья"]
LAST_NAMES = ["Иванов", "Петров", "Сидоров", "Козлов", "Новиков",
              "Морозов", "Попов", "Лебедев", "Ковалёв", "Орлов"]
PATRONYMICS = ["Иванович", "Петрович", "Сергеевич", "Александрович", "Николаевич"]

ORG_TYPES = ["ИП", "ООО", "ЧУП", "УП", "ОАО"]
ORG_NAMES = ["Ромашка", "Алмаз", "Прогресс", "Технологии", "Сервис",
             "Строй", "Торг", "Бизнес", "Консалт", "Медиа"]

TX_DESCRIPTIONS = [
    "Оплата по договору", "Реализация товаров", "Услуги разработки",
    "Аренда офиса", "Закупка материалов", "Маркетинговые услуги",
    "Транспортные расходы", "Консультационные услуги", "Ремонт оборудования",
]


def random_name() -> str:
    return f"{random.choice(LAST_NAMES)} {random.choice(FIRST_NAMES)} {random.choice(PATRONYMICS)}"


def random_org_name(i: int) -> str:
    org_type = random.choice(ORG_TYPES)
    name = random.choice(ORG_NAMES)
    return f"{org_type} {name}-{i}"


def random_unp(i: int) -> str:
    """Генерируем УНП — 9 цифр, уникальный."""
    base = 600000000 + i
    return str(base)


def random_date(days_back: int = 90) -> str:
    d = date.today() - timedelta(days=random.randint(0, days_back))
    return d.isoformat()


def random_amount(min_val: float = 50, max_val: float = 5000) -> str:
    return f"{random.uniform(min_val, max_val):.2f}"


# ── Основная логика ───────────────────────────────────────────────────

class DataGenerator:
    def __init__(self, api_url: str, count: int):
        self.api_url = api_url.rstrip("/")
        self.count = count
        self.created = 0
        self.errors = 0
        self.tokens: list[dict] = []

    def register_org(self, i: int) -> dict | None:
        """Регистрирует организацию и возвращает токены."""
        payload = {
            "email": f"load_test_{i}_{int(time.time())}@finklik-test.by",
            "password": "LoadTest1A",
            "full_name": random_name(),
            "org_name": random_org_name(i),
            "org_unp": random_unp(i),
        }

        if not HAS_HTTPX:
            # Без httpx — симулируем данные
            return {"access_token": f"mock_token_{i}", "org_id": f"org_{i}", "email": payload["email"]}

        try:
            r = httpx.post(
                f"{self.api_url}/api/v1/auth/register",
                json=payload,
                timeout=10,
            )
            if r.status_code == 201:
                data = r.json()
                data["email"] = payload["email"]
                return data
            elif r.status_code == 409:
                # Уже существует — пробуем логин
                lr = httpx.post(
                    f"{self.api_url}/api/v1/auth/login",
                    json={"email": payload["email"], "password": payload["password"]},
                    timeout=5,
                )
                if lr.status_code == 200:
                    data = lr.json()
                    data["email"] = payload["email"]
                    return data
            return None
        except Exception as e:
            return None

    def add_transactions(self, access_token: str, count: int = 10) -> int:
        """Добавляет случайные транзакции для организации."""
        if not HAS_HTTPX:
            return count

        headers = {"Authorization": f"Bearer {access_token}"}
        added = 0
        for _ in range(count):
            tx_type = random.choice(["income", "expense"])
            payload = {
                "type": tx_type,
                "amount": random_amount(100 if tx_type == "income" else 50, 3000),
                "description": f"{random.choice(TX_DESCRIPTIONS)} №{random.randint(1, 999)}",
                "transaction_date": random_date(90),
            }
            try:
                r = httpx.post(
                    f"{self.api_url}/api/v1/transactions",
                    json=payload,
                    headers=headers,
                    timeout=5,
                )
                if r.status_code == 201:
                    added += 1
            except Exception:
                pass
        return added

    def run(self):
        print(f"\n📊 Генерация тестовых данных")
        print(f"   API: {self.api_url}")
        print(f"   Организаций: {self.count}")
        print(f"   Транзакций на орг.: 10–30")
        print()

        if not HAS_HTTPX:
            print("  ⚠ httpx не установлен — симуляция без реальных запросов")
            print("  Установи: pip install httpx")

        start = time.time()
        results = []

        for i in range(1, self.count + 1):
            # Регистрация
            org_data = self.register_org(i)

            if org_data:
                self.created += 1
                token = org_data.get("access_token", "")

                # Добавляем транзакции
                tx_count = random.randint(10, 30)
                tx_added = self.add_transactions(token, tx_count)

                results.append({
                    "org": i,
                    "email": org_data.get("email", ""),
                    "transactions": tx_added,
                })

                if i % 10 == 0 or i == self.count:
                    elapsed = time.time() - start
                    rps = self.created / elapsed if elapsed > 0 else 0
                    print(f"  [{i:4d}/{self.count}] Создано: {self.created} | "
                          f"Ошибок: {self.errors} | {rps:.1f} орг/сек")
            else:
                self.errors += 1

            # Небольшая задержка чтобы не перегрузить
            if self.count > 100:
                time.sleep(0.01)

        elapsed = time.time() - start
        print(f"\n{'='*50}")
        print(f"✅ Готово за {elapsed:.1f} сек")
        print(f"   Создано организаций: {self.created}")
        print(f"   Ошибок: {self.errors}")
        print(f"   Средняя скорость: {self.created/elapsed:.1f} орг/сек")

        # Сохраняем результат
        report_path = f"reports/test_data_{int(time.time())}.json"
        import os; os.makedirs("reports", exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump({
                "generated": self.created,
                "errors": self.errors,
                "duration_sec": round(elapsed, 2),
                "sample": results[:5],
            }, f, ensure_ascii=False, indent=2)
        print(f"   Отчёт: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="Генератор тестовых данных ФинКлик")
    parser.add_argument("--count", type=int, default=10, help="Количество организаций")
    parser.add_argument("--api", default="http://localhost:8000", help="URL API")
    args = parser.parse_args()

    gen = DataGenerator(api_url=args.api, count=args.count)
    gen.run()


if __name__ == "__main__":
    main()
