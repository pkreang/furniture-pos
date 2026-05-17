#!/usr/bin/env bash
# Daily PostgreSQL backup for the furniture-pos production stack.
# Dumps the database from the running `postgres` container, gzips it to a
# timestamped file, and prunes dumps older than RETENTION_DAYS.
#
# Schedule from the VPS crontab, e.g. every day at 02:00:
#   0 2 * * * /path/to/furniture-pos/scripts/backup.sh >> /var/log/pos-backup.log 2>&1
#
# Copy the backup directory off the VPS regularly (see docs/GO-LIVE.md).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_DIR/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Read the DB user/name from the repo .env.
set -a
# shellcheck disable=SC1091
source "$REPO_DIR/.env"
set +a

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F-%H%M)"
OUT="$BACKUP_DIR/pos-$STAMP.sql.gz"

echo "[backup] dumping $POSTGRES_DB -> $OUT"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT"

echo "[backup] pruning dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'pos-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "[backup] done: $OUT"
