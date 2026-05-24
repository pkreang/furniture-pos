# Deploying to the VPS

Prerequisites: Docker + Docker Compose on the VPS.

1. Clone the repo onto the VPS.
2. `cp .env.example .env` and set strong values. For production `DATABASE_URL`
   the host is the compose service name: `postgresql://USER:PASS@postgres:5432/DB`.
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. The web app is served on port 80. Put a TLS reverse proxy
   (e.g. Caddy, or nginx with certbot) in front for HTTPS.

See `docs/GO-LIVE.md` for the full launch runbook (seeding, data migration,
the smoke-test checklist, and rollback) and `docs/SECURITY.md` for the
security review.

## Daily backup (cron on the VPS)

Backups use `scripts/backup.sh` — it dumps the database from the running
`postgres` container, gzips it to `/backups` (override with `BACKUP_DIR`), and
prunes dumps older than 14 days (`RETENTION_DAYS`).

Add to the VPS crontab — every day at 02:00:

    0 2 * * * /path/to/furniture-pos/scripts/backup.sh >> /var/log/pos-backup.log 2>&1

Restore a dump with `scripts/restore.sh /backups/pos-YYYY-MM-DD-HHMM.sql.gz`.

Copy `/backups` off the VPS regularly.

