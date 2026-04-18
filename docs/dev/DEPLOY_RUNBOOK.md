# Деплой API и базы данных

Краткий чеклист для Render / VPS / любого окружения с PostgreSQL.

## 1. Перед выкатом

- Убедиться, что CI зелёный (`main` / PR).
- Зафиксировать версию коммита и тег фронта (если релиз).

## 2. Миграции Alembic

Локально проверить граф ревизий без подключения к БД:

```bash
make alembic-heads
# или: cd backend/api-gateway && python -m alembic heads
```

На сервере с доступом к **боевой** `DATABASE_URL`:

```bash
cd backend/api-gateway
export DATABASE_URL="postgresql+asyncpg://..."   # ваш URL
python -m alembic upgrade head
```

Проверить текущую ревизию (опционально):

```bash
python -m alembic current
```

### Цепочка ревизий (история)

| Revision ID | Файл | Назначение |
|-------------|------|------------|
| `sprint6_primary_docs` | `20260415_sprint6_primary_documents.py` | Первичные документы |
| `sprint7_onec_contours` | `20260415_sprint7_onec_contours.py` | Контуры 1С |
| `sprint9_payment_events` | `20260415_sprint9_payment_events.py` | События оплат |
| `add_org_columns` | `20260416_add_org_columns.py` | Колонки организаций (legal_form, tax_regime, …) |
| `sprint10_scanned_documents` | `20260417_scanned_documents.py` | Таблица сканов OCR |
| `sprint12_regulatory_reporting` | `20260418_regulatory_reporting_tables.py` | Регламентные обновления и `report_submissions` |

Head репозитория: **`sprint12_regulatory_reporting`**.

## 3. После выката

- `GET /health` — 200.
- Смоук по [`PRE_DEMO_SMOKE.md`](PRE_DEMO_SMOKE.md) (в т.ч. сканер и подача отчётов при использовании).
- Убедиться, что фронт указывает на новый API (`VITE_API_URL` / GitHub Pages).

## 4. Откат

Откат миграций в проде без бэкапа БД не рекомендуется. Имеет смысл только `alembic downgrade` на отдельной копии БД или через snapshot провайдера.

## 5. Локальная разработка

Рекомендуемый Python для backend: **3.11** (см. [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md)). Файл [`.python-version`](../../.python-version) в корне репозитория задаёт **3.11** для pyenv/asdf.

## 6. PDF white-label для sales (опционально)

После правок маркетингового текста в [`docs/sales/_gen_pdf.py`](../sales/_gen_pdf.py) можно пересобрать PDF для рассылки:

```bash
pip install reportlab
python docs/sales/_gen_pdf.py
```

Результат: `docs/sales/ФинКлик_WhiteLabel_Банки.pdf` (рядом со скриптом). Не входит в CI; выполняйте локально при обновлении слайдов.
