#!/usr/bin/env python3
"""
load_test.py — Нагрузочное тестирование ФинКлик.
Симуляция 1000 одновременных пользователей.

Запуск:
  python3 scripts/load_test.py --users 100 --duration 30
  python3 scripts/load_test.py --users 1000 --duration 60
"""
import argparse
import asyncio
import time
import json
import random
import statistics
import os
from datetime import date, timedelta

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


# ── Метрики ───────────────────────────────────────────────────────────

class Metrics:
    def __init__(self):
        self.latencies: list[float] = []
        self.errors: int = 0
        self.requests: int = 0
        self.by_endpoint: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def record(self, endpoint: str, latency_ms: float, success: bool):
        async with self._lock:
            self.requests += 1
            if success:
                self.latencies.append(latency_ms)
                self.by_endpoint.setdefault(endpoint, []).append(latency_ms)
            else:
                self.errors += 1

    def summary(self) -> dict:
        if not self.latencies:
            return {"error": "No successful requests"}

        sorted_lat = sorted(self.latencies)
        n = len(sorted_lat)
        return {
            "total_requests": self.requests,
            "successful": len(self.latencies),
            "errors": self.errors,
            "error_rate_pct": round(self.errors / max(self.requests, 1) * 100, 3),
            "latency_ms": {
                "min":  round(sorted_lat[0], 1),
                "avg":  round(statistics.mean(sorted_lat), 1),
                "p50":  round(sorted_lat[int(n * 0.50)], 1),
                "p95":  round(sorted_lat[int(n * 0.95)], 1),
                "p99":  round(sorted_lat[int(n * 0.99)], 1),
                "max":  round(sorted_lat[-1], 1),
            },
            "by_endpoint": {
                ep: {
                    "count": len(lats),
                    "avg_ms": round(statistics.mean(lats), 1),
                    "p95_ms": round(sorted(lats)[int(len(lats) * 0.95)], 1),
                }
                for ep, lats in self.by_endpoint.items()
            },
        }


metrics = Metrics()


# ── Сценарии ──────────────────────────────────────────────────────────

async def scenario_health(client: "httpx.AsyncClient", base_url: str):
    """Простая проверка health endpoint."""
    t0 = time.perf_counter()
    try:
        r = await client.get(f"{base_url}/health", timeout=5)
        ms = (time.perf_counter() - t0) * 1000
        await metrics.record("/health", ms, r.status_code == 200)
    except Exception:
        await metrics.record("/health", 9999, False)


async def scenario_auth(client: "httpx.AsyncClient", base_url: str) -> str | None:
    """Регистрация или логин пользователя."""
    i = random.randint(1, 10000)
    payload = {
        "email": f"load_{i}@test.by",
        "password": "LoadTest1",
        "full_name": f"Тест {i}",
        "org_name": f"ИП Тест {i}",
        "org_unp": f"6{str(i).zfill(8)}",
    }
    t0 = time.perf_counter()
    try:
        r = await client.post(f"{base_url}/api/v1/auth/register", json=payload, timeout=5)
        ms = (time.perf_counter() - t0) * 1000
        if r.status_code in (201, 409):
            await metrics.record("/auth/register", ms, True)
            if r.status_code == 201:
                return r.json().get("access_token")
        else:
            await metrics.record("/auth/register", ms, False)
    except Exception:
        await metrics.record("/auth/register", 9999, False)
    return None


async def scenario_dashboard(client: "httpx.AsyncClient", base_url: str, token: str):
    """Просмотр дашборда."""
    t0 = time.perf_counter()
    try:
        r = await client.get(
            f"{base_url}/api/v1/dashboard",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        ms = (time.perf_counter() - t0) * 1000
        await metrics.record("/dashboard", ms, r.status_code == 200)
    except Exception:
        await metrics.record("/dashboard", 9999, False)


async def scenario_create_transaction(client: "httpx.AsyncClient", base_url: str, token: str):
    """Создание транзакции."""
    payload = {
        "type": random.choice(["income", "expense"]),
        "amount": f"{random.uniform(100, 2000):.2f}",
        "description": f"Тест {random.randint(1, 9999)}",
        "transaction_date": date.today().isoformat(),
    }
    t0 = time.perf_counter()
    try:
        r = await client.post(
            f"{base_url}/api/v1/transactions",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        ms = (time.perf_counter() - t0) * 1000
        await metrics.record("/transactions POST", ms, r.status_code == 201)
    except Exception:
        await metrics.record("/transactions POST", 9999, False)


async def user_session(user_id: int, base_url: str, duration: int):
    """Полная сессия одного виртуального пользователя."""
    if not HAS_HTTPX:
        # Без httpx — симулируем задержки
        end = time.time() + duration
        while time.time() < end:
            await asyncio.sleep(random.uniform(0.1, 1.0))
            ms = random.uniform(50, 400)
            ep = random.choice(["/health", "/dashboard", "/transactions POST"])
            await metrics.record(ep, ms, random.random() > 0.01)
        return

    async with httpx.AsyncClient(timeout=10) as client:
        end = time.time() + duration

        # Авторизация
        token = await scenario_auth(client, base_url)
        if not token:
            return

        while time.time() < end:
            # Случайный сценарий с весами
            r = random.random()
            if r < 0.3:
                await scenario_health(client, base_url)
            elif r < 0.6:
                await scenario_dashboard(client, base_url, token)
            elif r < 0.9:
                await scenario_create_transaction(client, base_url, token)
            else:
                await scenario_dashboard(client, base_url, token)

            await asyncio.sleep(random.uniform(0.1, 2.0))


async def run_load_test(users: int, duration: int, base_url: str):
    print(f"\n⚡ Нагрузочный тест ФинКлик")
    print(f"   Пользователей: {users}")
    print(f"   Длительность:  {duration} сек")
    print(f"   API:           {base_url}")

    if not HAS_HTTPX:
        print("   ⚠ httpx не установлен — симуляция без HTTP запросов")

    print(f"\n   Запускаем {users} виртуальных пользователей...")
    start = time.time()

    # Запускаем всех пользователей с небольшим ramp-up
    tasks = []
    for i in range(users):
        # Распределяем старт по первым 10% времени (ramp-up)
        delay = (duration * 0.1 / users) * i
        task = asyncio.create_task(_delayed_session(i, base_url, duration, delay))
        tasks.append(task)

    # Промежуточный вывод каждые 10 секунд
    async def progress():
        while True:
            await asyncio.sleep(10)
            elapsed = time.time() - start
            if elapsed >= duration + 5:
                break
            rps = metrics.requests / elapsed if elapsed > 0 else 0
            print(f"   [{elapsed:4.0f}s] req: {metrics.requests} | "
                  f"errors: {metrics.errors} | {rps:.1f} req/s")

    progress_task = asyncio.create_task(progress())
    await asyncio.gather(*tasks)
    progress_task.cancel()

    elapsed = time.time() - start
    summary = metrics.summary()

    # ── Вывод результатов ────────────────────────────────────────────
    print(f"\n{'='*52}")
    print(f"  РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТА")
    print(f"{'='*52}")
    print(f"  Длительность:    {elapsed:.1f} сек")
    print(f"  Запросов всего:  {summary.get('total_requests', 0)}")
    print(f"  Успешных:        {summary.get('successful', 0)}")
    print(f"  Ошибок:          {summary.get('errors', 0)} ({summary.get('error_rate_pct', 0):.3f}%)")

    lat = summary.get("latency_ms", {})
    print(f"\n  Задержка (мс):")
    print(f"    min:  {lat.get('min', 0)}")
    print(f"    avg:  {lat.get('avg', 0)}")
    print(f"    p50:  {lat.get('p50', 0)}")
    print(f"    p95:  {lat.get('p95', 0)}  {'✓' if lat.get('p95', 999) < 500 else '✗ >500ms!'}")
    print(f"    p99:  {lat.get('p99', 0)}")
    print(f"    max:  {lat.get('max', 0)}")

    # Проверяем пороги
    print(f"\n  Пороговые значения:")
    p95_ok = lat.get("p95", 999) < 500
    err_ok = summary.get("error_rate_pct", 100) < 0.1
    print(f"    p95 < 500ms:      {'✓ ОК' if p95_ok else '✗ ПРОВАЛ'}")
    print(f"    ошибки < 0.1%:    {'✓ ОК' if err_ok else '✗ ПРОВАЛ'}")

    # Сохраняем отчёт
    os.makedirs("reports", exist_ok=True)
    report_path = f"reports/load_test_{int(time.time())}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "config": {"users": users, "duration": duration, "api": base_url},
            "results": summary,
            "thresholds": {"p95_ok": p95_ok, "error_rate_ok": err_ok},
        }, f, ensure_ascii=False, indent=2)
    print(f"\n  Отчёт: {report_path}")
    print(f"{'='*52}\n")

    return p95_ok and err_ok


async def _delayed_session(user_id: int, base_url: str, duration: int, delay: float):
    if delay > 0:
        await asyncio.sleep(delay)
    await user_session(user_id, base_url, duration)


def main():
    parser = argparse.ArgumentParser(description="Нагрузочный тест ФинКлик")
    parser.add_argument("--users", type=int, default=100)
    parser.add_argument("--duration", type=int, default=30)
    parser.add_argument("--api", default="http://localhost:8000")
    args = parser.parse_args()

    success = asyncio.run(run_load_test(args.users, args.duration, args.api))
    exit(0 if success else 1)


if __name__ == "__main__":
    main()
