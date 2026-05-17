#!/usr/bin/env bash
# Restores a gzipped pg_dump produced by scripts/backup.sh into the running
# `postgres` container.
#
#   ./scripts/restore.sh /backups/pos-2026-05-17-0200.sql.gz
#
# WARNING: this overwrites the current database contents.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_DIR/docker-compose.prod.yml}"

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "usage: $0 <path-to-pos-*.sql.gz>" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$REPO_DIR/.env"
set +a

echo "About to restore '$DUMP' into database '$POSTGRES_DB'."
echo "This OVERWRITES current data. Type 'yes' to continue:"
read -r CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "aborted"; exit 1; }

echo "[restore] restoring $DUMP"
gunzip -c "$DUMP" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "[restore] done"
