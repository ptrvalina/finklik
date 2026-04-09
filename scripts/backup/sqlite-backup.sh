#!/usr/bin/env bash
# Копия файла SQLite (локальная разработка без Docker).
# Использование: SQLITE_DB=path/to/finklik.db ./sqlite-backup.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../../backups/sqlite}"
SQLITE_DB="${SQLITE_DB:-$SCRIPT_DIR/../../backend/api-gateway/finklik.db}"
STAMP="$(date +%Y%m%d_%H%M%S)"

if [[ ! -f "$SQLITE_DB" ]]; then
  echo "Файл БД не найден: $SQLITE_DB" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/finklik_${STAMP}.db"
cp -f "$SQLITE_DB" "$OUT"
echo "Скопировано: $OUT"
