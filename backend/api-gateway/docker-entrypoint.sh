#!/bin/sh
set -e
cd /app
if command -v alembic >/dev/null 2>&1; then
  alembic upgrade head || echo "warn: alembic upgrade failed — проверьте DATABASE_URL; API поднимем всё равно"
fi
exec "$@"
