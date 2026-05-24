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

## Render Static Site (web)

The web app is deployed on Render as a Static Site at
`https://elite-shop.onrender.com`. The API runs on a separate Render service
at `https://elite-rzpk.onrender.com`.

`render.yaml` at the repo root declares the Static Site (build command,
publish directory, and the two URL rewrites). `apps/web/public/_redirects`
holds the same rewrite rules in Netlify syntax — Render reads this file from
the publish directory at request time.

Why two places? `render.yaml` is the dashboard-level IaC config that
provisions the service. `_redirects` is what the deployed Static Site reads
at runtime to handle each incoming request — it must be present in
`apps/web/dist/` (Vite copies anything in `apps/web/public/` to `dist/` at
build time).

The first rewrite proxies `/api/*` server-side to the API service. The
browser only ever talks to `elite-shop.onrender.com`, so CORS is a non-issue
and the session cookie stays first-party (`SameSite=Lax`). The second
rewrite is the SPA fallback that sends every non-asset route to
`/index.html` so `vue-router` can render it client-side.

### Creating the Render Static Site

If the service doesn't exist yet:

1. Render dashboard → New + → Static Site → connect this repo, branch `main`
2. Name: `elite-shop`
3. Render auto-detects `render.yaml` and pre-fills the build command + publish
   directory. If creating manually:
   - Build command: `npm install && npm run build --workspace apps/web`
   - Publish directory: `apps/web/dist`
4. Create + Deploy. The first build takes ~2-3 min; subsequent deploys are
   triggered automatically by `main` pushes.

### Adding a custom domain later

When ready to move off the `*.onrender.com` subdomain to e.g.
`shop.elitedesign.co.th`:

1. Render dashboard → the `elite-shop` service → Settings → Custom Domains →
   Add Custom Domain → enter the domain
2. Render shows a CNAME target. Add a CNAME record at your DNS provider
   pointing the subdomain at that target.
3. Wait ~1-10 min. Render auto-issues a Let's Encrypt certificate.
4. The old `*.onrender.com` URL keeps working.

No code change is needed for the custom domain — the proxy in `_redirects`
already targets the API by its `*.onrender.com` URL, so the only thing that
changes is which hostname the browser hits.

