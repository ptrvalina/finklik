# ФинКлик — Руководство разработчика

## Быстрый старт (5 минут)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/your-org/finklik.git
cd finklik

# 2. Bootstrap (один раз)
bash scripts/bootstrap.sh

# 3. Запустить всё
make dev
```

Открой **http://localhost:5173** — готово.

---

## Структура проекта

```
finklik/
├── backend/
│   └── api-gateway/
│       └── app/
│           ├── api/v1/endpoints/   ← FastAPI роутеры
│           ├── core/               ← config, database, security, deps
│           ├── models/             ← SQLAlchemy модели
│           ├── schemas/            ← Pydantic схемы
│           ├── security/           ← middleware, аудит, шифрование
│           ├── services/           ← бизнес-логика (налоги, экспорт)
│           ├── cache/              ← Redis кэш
│           ├── websocket/          ← WebSocket уведомления
│           └── main.py             ← точка входа
├── frontend/web/src/
│   ├── pages/                      ← React страницы
│   ├── components/                 ← UI компоненты
│   ├── api/                        ← axios клиент
│   └── store/                      ← Zustand store
├── scripts/                        ← утилиты разработки
├── tests/                          ← тесты
├── infrastructure/                 ← docker, terraform
├── docs/                           ← документация
└── Makefile                        ← команды разработки
```

---

## Команды

```bash
make dev          # Поднять всё окружение
make stop         # Остановить
make test         # Все тесты
make test-unit    # Только юнит-тесты
make security     # Аудит безопасности
make lint         # Проверка кода
make seed         # Загрузить тестовые данные (10 орг)
make logs SVC=backend   # Логи конкретного сервиса
make clean        # Полная очистка
```

---

## Версии Python (backend)

- Рекомендуется: `Python 3.11` (CI baseline).
- Поддерживаемо: `Python 3.12` (после локальной проверки).
- Не рекомендуется для локальных интеграционных тестов: `Python 3.14` (известная несовместимость `passlib`/`bcrypt`).

### Troubleshooting: `passlib` / `bcrypt` на Python 3.14

Если интеграционные тесты падают с ошибками вида `bcrypt`/`passlib`, переключите окружение backend на `Python 3.11`.

Быстрый чек:

```bash
python --version
```

Рекомендуемый запуск тестов:

```bash
cd backend/api-gateway
python -m pytest tests/unit -q
```

---

## Как добавить новый API эндпоинт

1. Создай схему в `app/schemas/your_module.py`
2. Создай или обнови модель в `app/models/your_model.py`
3. Создай роутер `app/api/v1/endpoints/your_endpoint.py`
4. Добавь роутер в `app/main.py`:
   ```python
   from app.api.v1.endpoints.your_endpoint import router as your_router
   app.include_router(your_router, prefix="/api/v1")
   ```
5. Напиши тест в `tests/unit/test_your_module.py`

**Пример минимального эндпоинта:**
```python
from fastapi import APIRouter, Depends
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/example", tags=["example"])

@router.get("")
async def list_items(current_user: User = Depends(get_current_user)):
    return {"items": [], "user": current_user.email}
```

---

## Как отладить проблему

### Бэкенд не запускается
```bash
make logs SVC=backend
# Смотрим ошибку, чаще всего: порт занят или нет .env
```

### База данных не подключается
```bash
make logs SVC=postgres
# Проверяем что postgres здоров
docker exec finklik-postgres pg_isready -U finklik
```

### Фронтенд не видит API (CORS ошибка)
```python
# app/core/config.py — добавь свой origin в CORS_ORIGINS
CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://YOUR_DOMAIN"]
```

### JWT токен не принимается
```bash
# Проверь что JWT_SECRET_KEY одинаковый в .env и переменных окружения
cat backend/api-gateway/.env | grep JWT
```

---

## Переменные окружения

| Переменная | DEV значение | Описание |
|-----------|-------------|---------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./finklik.db` | URL базы данных |
| `REDIS_URL` | `redis://localhost:6379/0` | URL Redis |
| `JWT_SECRET_KEY` | генерируется | Секрет для JWT |
| `MOCK_BANK_URL` | `http://localhost:8001` | URL mock банка |
| `ONEC_MOCK_URL` | `http://localhost:8002` | URL mock 1С |
| `DEBUG` | `true` | Режим отладки |

---

## Тестирование

```bash
# Юнит-тесты (быстро, без сервера)
cd backend/api-gateway
python3 -m pytest ../../tests/unit/ -v

# Нагрузочный тест (нужен запущенный сервер)
python3 scripts/load_test.py --users 100 --duration 30

# Генерация тестовых данных
python3 scripts/generate_test_data.py --count 50
```

---

## Архитектура безопасности

```
Запрос → RateLimitMiddleware (100/мин) → SecurityHeadersMiddleware
       → CORSMiddleware → FastAPI Router
       → JWT verify (get_current_user) → Endpoint
       → audit_log() → Response
```

Персональные данные сотрудников шифруются перед записью в БД:
```python
from app.security import get_encryptor
enc = get_encryptor()
encrypted = enc.encrypt("Иванов Иван Иванович")  # для записи
original  = enc.decrypt(encrypted)               # для чтения
```

---

## Добавление нового разработчика

1. Выдать доступ к репозиторию
2. Выдать доступ к DEV секретам (`.env` файл)
3. Запустить `bash scripts/bootstrap.sh`
4. Запустить `make dev`
5. Открыть `http://localhost:5173`

Время до первого запуска: **5 минут**.

---

## Контакты

- Telegram поддержка: @finklik_dev
- API документация: http://localhost:8000/docs
- Swagger UI: http://localhost:8000/redoc
