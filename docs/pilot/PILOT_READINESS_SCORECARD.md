# Pilot Readiness Scorecard — справка

**Назначение:** одна страница для команды внедрения — можно ли подключать **следующего** клиента.

---

## Как получить актуальный scorecard

```bash
make pilot-check
```

Результат: **`artifacts/pilot-readiness-scorecard.md`** (автогенерация, не коммитить).

### Переменные окружения

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `PILOT_API_URL` | `http://localhost:8000` | Базовый URL API для `/health` |
| `PILOT_TARGET` | `local` | `local` — dev; `production` — строже (PG, secrets) |
| `PILOT_LIMITATIONS_ACK` | — | `1` = команда подтвердила ограничения из PILOT_SCOPE |
| `PILOT_SKIP_BUILD` | — | `1` — пропустить `npm run build` (быстрее) |

Пример prod-проверки:

```bash
PILOT_API_URL=https://finklik-api.onrender.com PILOT_TARGET=production PILOT_LIMITATIONS_ACK=1 make pilot-check
```

---

## Блоки scorecard

| Блок | Что проверяется | 🟢 | 🟡 | 🔴 |
|------|-----------------|----|----|-----|
| **Infrastructure** | `/health`, `/api/v1/health` | 200 OK | degraded | недоступен |
| **PostgreSQL** | `DATABASE_URL` | `postgresql*` | sqlite (local) | нет URL |
| **Secrets** | JWT, DEBUG | rotated + DEBUG off (prod) | dev secrets (local) | dev secrets on prod |
| **Email** | `EMAIL_API_KEY` | настроен | ручные invite | — |
| **OCR** | `test_ocr_parse` | PASS | — | FAIL |
| **Bank import** | OAuth или mock bank | OAuth или mock OK | только manual JSON | mock недоступен |
| **Reporting (mock)** | portal mode + capabilities | mock/http OK | — | API error |
| **Demo smoke** | alembic + pytest + build | all PASS | build skipped | FAIL |
| **Pilot seed** | `/api/v1/pilot/seed-template` | endpoint exists | — | missing |
| **Known limitations** | PILOT_SCOPE + ack | ack=1 | scope без ack | scope missing |

---

## Итоговый вердикт

| Статус | Условие |
|--------|---------|
| **🟢 Ready for Pilot** | Нет 🔴; не более 1 некритичного 🟡 на prod |
| **🟡 Ready with Limitations** | Нет 🔴; есть 🟡 (sqlite, email, mock bank, без ack) |
| **🔴 Not Ready** | Любой 🔴 в Infrastructure, Secrets (prod), Demo smoke, OCR |

---

## Связанные документы

- [PILOT_SCOPE.md](./PILOT_SCOPE.md) — для клиента  
- [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) — ручной чеклист на org  
- [../dev/PRE_DEMO_SMOKE.md](../dev/PRE_DEMO_SMOKE.md) — UI smoke перед демо  
- [../dev/DEMO_TENANT_CHECKLIST.md](../dev/DEMO_TENANT_CHECKLIST.md) — стабильный demo tenant  

---

*Шаблон scorecard. Живые статусы — только в `artifacts/` после `make pilot-check`.*
