#!/usr/bin/env python3
"""Create all ORM tables for E2E (fresh SQLite file)."""

from __future__ import annotations

import asyncio
import sys


async def _main() -> None:
    from app import models as _models  # noqa: F401
    from app.core.database import Base, engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(_main())
    print("E2E database ready.", file=sys.stderr)
