# Go-live Runbook

The launch procedure for Elite POS. See `docs/DEPLOY.md` for the
deploy mechanics and `docs/SECURITY.md` for the security review.

## 1. Pre-launch checklist

- [ ] VPS has Docker + Docker Compose.
- [ ] Repo cloned; `.env` created from `.env.example` with **strong, unique**
      secrets (`POSTGRES_PASSWORD`, `SEED_ADMIN_PASSWORD`, and — if used —
      SMTP/LINE credentials). Production `DATABASE_URL` host is the compose
      service name: `postgresql://USER:PASS@postgres:5432/DB`.
- [ ] A TLS reverse proxy (Caddy, or nginx + certbot) is in front of the `web`
      container — `secure` session cookies require HTTPS.
- [ ] The daily backup cron is installed (`scripts/backup.sh`) and the backup
      directory is copied off-site.

## 2. Deploy

    docker compose -f docker-compose.prod.yml up -d --build

The `api` container runs `prisma migrate deploy` on start, so the schema is
created/updated automatically. Then seed the baseline data (roles,
permissions, sofa materials, company settings, and the admin account):

    docker compose -f docker-compose.prod.yml exec api npx prisma db seed

## 3. Real data migration

The system ships with **no fake business data**. Load the shop's real data
through the **Import / Export** screen (requires the `data.manage` permission):

1. Export an empty sheet for each entity to get the column template, or build
   `.xlsx` files with these columns:
   - **products** — `sku`, `name`, `category`, `basePrice`, `isSofa`
   - **customers** — `name`, `phone`, `email`
   - **stock** — `sku`, `branchCode`, `quantity`
2. Import in order: **products → customers → stock** (stock import needs the
   products and branches to exist first).
3. After each import, review the per-row error report and fix-and-re-import any
   rejected rows.

Branches and delivery zones/channels/teams are entered through their own
management screens.

## 4. Post-deploy smoke test

- [ ] Open the site → redirected to the login page.
- [ ] Log in as the seeded admin → forced to the change-password screen;
      set a strong password.
- [ ] Dashboard loads.
- [ ] Ring up a sale in POS → receipt shows the VAT split and a per-branch
      number; stock decremented.
- [ ] Void that sale → stock returns, status `VOIDED`.
- [ ] Book a delivery for a sale and advance its status.
- [ ] Generate a Z-report for the branch.
- [ ] Confirm `/health` returns `{"status":"ok"}` and responses carry the
      security headers.

## 5. Backup & restore drill

Before relying on backups, prove a restore works:

    ./scripts/backup.sh                       # produces /backups/pos-*.sql.gz
    ./scripts/restore.sh /backups/pos-*.sql.gz   # restore drill (use a staging DB)

## 6. Rollback

- App rollback: `git checkout <previous-tag>` then re-run the deploy command;
  Prisma migrations are forward-only — do not roll the schema back blindly.
- Data rollback: restore the most recent good dump with `scripts/restore.sh`.
- The containers use `restart: unless-stopped`, so a crashed process recovers
  on its own; the API also shuts down gracefully on redeploy.
