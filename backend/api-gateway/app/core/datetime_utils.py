"""Хранение моментов времени в колонках SQLAlchemy DateTime без timezone=True (TIMESTAMP WITHOUT TIME ZONE).

PostgreSQL/asyncpg не принимают aware-datetime для таких колонок — используем UTC без tzinfo.
"""

from __future__ import annotations

from datetime import datetime, timezone


def utc_now_naive() -> datetime:
    """Текущий момент в UTC как naive datetime (семантика: UTC wall time)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
