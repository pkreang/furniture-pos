# Deploying to the VPS

Prerequisites: Docker + Docker Compose on the VPS.

1. Clone the repo onto the VPS.
2. `cp .env.example .env` and set strong values. For production `DATABASE_URL`
   the host is the compose service name: `postgresql://USER:PASS@postgres:5432/DB`.
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. The web app is served on port 80. Put a TLS reverse proxy
   (e.g. Caddy, or nginx with certbot) in front for HTTPS — see Phase 10.

## Daily backup (cron on the VPS)

Add to crontab — dumps the database every day at 02:00 and keeps 14 days:

    0 2 * * * docker compose -f /path/docker-compose.prod.yml exec -T postgres \
      pg_dump -U furniture furniture_pos | gzip > /backups/pos-$(date +\%F).sql.gz \
      && find /backups -name "pos-*.sql.gz" -mtime +14 -delete

Copy `/backups` off the VPS regularly.
