# FinClick — design tokens (поверхности)

Единая иерархия для Financial OS: меньше произвольных `border`/`shadow` в JSX, больше семантических классов из `frontend/web/src/index.css`.

## Три уровня поверхности

| Уровень | Класс | Когда использовать |
|--------|--------|-------------------|
| **L1 — секция страницы** | `page-section` · `fc-surface-section` | Списки, формы, таблицы, блоки настроек, отправки отчётов |
| **L2 — execution / calm** | `fc-calm-surface` · `fc-surface-calm` · `fc-execution-card` | Лента работы, готовность, financial state, приоритеты, focus strip |
| **L3 — elevated** | `card-elevated` · `fc-surface-elevated` | Гид отчётности, auth-карточки, акцентные панели с hover-lift |

## Модификаторы execution

| Класс | Смысл |
|--------|--------|
| `fc-execution-card--tone-ok` | Норма / под контролем |
| `fc-execution-card--tone-warn` | Нужны действия |
| `fc-execution-card--tone-risk` | Блокеры / риск |
| `fc-execution-card--tone-ready` | Готов к сдаче |
| `fc-execution-card--tone-pending` | В работе |
| `fc-execution-card--hero` | Главная карточка на экране |

## Строки приоритетов и навигация

| Класс | Когда |
|--------|--------|
| `fc-priority-row` + `--primary` / `--amber` / `--neutral` | Кликабельные приоритеты (hub учёта, workspace) |
| `fc-nav-chip` | Вторичные shortcuts (разделы учёта) |
| `fc-focus-strip` + `--primary` / `--amber` / `--neutral` | `FocusStrip` в `OperationalPage` |

## CSS-переменные (`:root`)

- `--fc-shadow-section`, `--fc-shadow-calm`, `--fc-shadow-elevated` (+ hover)
- `--fc-surface-border*`, `--fc-surface-bg-*`
- `--fc-radius-xl`, `--fc-space-section-*`, `--fc-duration-*`

## Правила для PR

1. **Не смешивать** L3 `card-elevated` с лишними `shadow-card` / `ring-*` без причины.
2. **Execution** — всегда через `fc-execution-card` (+ tone), не дублировать `rounded-2xl border bg-surface/90`.
3. **Секции** — `page-section` или `fc-surface-section`, padding через класс или `p-*` поверх.
4. Новые экраны в потоке **Учёт / Отчётность / Лента** — только L1–L2, L3 только для guided/auth.

## Аудит (P8)

- Учёт: hub priorities, capture form, shortcuts → токены
- Отчётность: guided flow → `fc-surface-elevated`
- Execution: `FinancialStateHero`, `ExecutionTaskCard`, `WorkPackCard`, readiness hero

## Stitch-редизайн (P12)

Палитра проекта уже совпадает со Stitch (`secondary #0058be`, `secondary-container #2170e4`, `tertiary #009668`, surfaces `#f7f9fb`/white, Inter + JetBrains Mono) — рецвет не требуется. Добавлены общие примитивы Stitch:

| Класс | Назначение |
|--------|-----------|
| `glass-card` | Базовый контейнер карточек: белая полупрозрачная поверхность + `blur(16px)` + мягкая тень. Есть dark-вариант и hover. |
| `fc-status` + `fc-status-ready` / `fc-status-pending` / `fc-status-action` | Статус-чипы: готово (emerald) · в работе (amber) · требует действия (red). |

Правила: новый премиум-UI собирать на `glass-card` (вместо ad-hoc `bg-white/90 backdrop-blur border shadow`); статусы — только через `fc-status-*`, без произвольных цветовых пилюль.
