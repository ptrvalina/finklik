"""Снижение когнитивной нагрузки: дубликаты и «шум» в ленте (Flow 9)."""

from __future__ import annotations

from app.schemas.operations_feed import OperationalItem, OperationalItemType

PRIORITY_RANK: dict[str, int] = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def collapse_operational_noise(items: list[OperationalItem]) -> list[OperationalItem]:
    """Оставить один пункт на пару (тип, заголовок) с максимальным приоритетом, порядок — как первое вхождение."""
    keys_order: list[tuple[OperationalItemType, str]] = []
    seen: set[tuple[OperationalItemType, str]] = set()
    for it in items:
        key = (it.type, (it.title or "").strip())
        if key not in seen:
            seen.add(key)
            keys_order.append(key)

    chosen: dict[tuple[OperationalItemType, str], OperationalItem] = {}
    for it in items:
        key = (it.type, (it.title or "").strip())
        cur = chosen.get(key)
        if cur is None or PRIORITY_RANK.get(it.priority, 0) > PRIORITY_RANK.get(cur.priority, 0):
            chosen[key] = it

    return [chosen[k] for k in keys_order if k in chosen]
