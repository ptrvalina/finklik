#!/usr/bin/env bash
# Дамп PostgreSQL (контейнер finklik-postgres из docker-compose.dev).
# Использование: ./postgres-backup.sh
# Переменные: BACKUP_DIR (по умолчанию ./backups рядом со скриптом), CONTAINER, PGUSER, PGDATABASE

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../../backups/postgres}"
CONTAINER="${POSTGRES_CONTAINER:-finklik-postgres}"
PGUSER="${PGUSER:-finklik}"
PGDATABASE="${PGDATABASE:-finklik}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/finklik_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Контейнер $CONTAINER не найден. Запустите: docker compose -f infrastructure/docker/docker-compose.dev.yml up -d postgres" >&2
  exit 1
fi

echo "Дамп в $OUT ..."
docker exec "$CONTAINER" pg_dump -U "$PGUSER" "$PGDATABASE" | gzip > "$OUT"
echo "Готово: $OUT"
