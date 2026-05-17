# Security Review

Reviewed at the end of Phase 10 against spec §8.4 and OWASP basics.

## Application controls — verified

| Control | Status | Where |
|---------|--------|-------|
| Passwords hashed with argon2 | ✓ | `apps/api/src/auth/password.ts` |
| Session tokens opaque, random, SHA-256-hashed at rest | ✓ | `apps/api/src/auth/session.ts` |
| Session cookie `httpOnly` + `sameSite=lax` + `secure` in production | ✓ | `apps/api/src/auth/routes.ts` (`COOKIE_OPTS`); `secure` keys off `NODE_ENV`, now set by `docker-compose.prod.yml` |
| Forced password change on first login | ✓ | seeded `mustChangePassword`, enforced by `requirePermission` |
| RBAC enforced server-side on every protected route | ✓ | `requirePermission` preHandler |
| Branch scoping enforced server-side | ✓ | `branchFilter` + per-route `BRANCH_FORBIDDEN` checks |
| Rate limiting on login (5/min) and globally (300/min) | ✓ | `apps/api/src/auth/plugin.ts` |
| Security headers (`X-Frame-Options`, `nosniff`, CSP, …) | ✓ | `@fastify/helmet` + nginx headers |
| SQL injection prevented | ✓ | Prisma parameterises all queries |
| XSS prevented | ✓ | Vue escapes interpolated text; no raw `innerHTML` |
| Two-sided validation | ✓ | Fastify JSON Schema on writes + frontend constraints |
| Errors return `{code,message}`, no stack trace leaked in production | ✓ | `apps/api/src/errors.ts` |
| Audit log of every mutation (never stores request bodies) | ✓ | `apps/api/src/audit/plugin.ts` |
| Secrets only in `.env`, which is git-ignored | ✓ | `.gitignore` lists `.env`; confirmed untracked |
| Startup config validation (fail fast) | ✓ | `apps/api/src/config.ts` |
| Graceful shutdown on SIGTERM/SIGINT | ✓ | `apps/api/src/server.ts` |

## Dependency audit (`npm audit`)

`npm audit` reports advisories, almost all in **development-only** tooling that
is never shipped to production:

- **esbuild / vite / vitest / happy-dom** — build and test tooling only. The
  esbuild advisory affects the local dev server, not the built artifacts.
- **fast-uri** — a transitive dependency of Fastify's JSON tooling. A fix
  requires a Fastify minor/major bump; tracked for a future maintenance update.
- **nodemailer** — runtime, but exercised only when SMTP is configured; keep it
  updated as part of routine maintenance.
- **xlsx (SheetJS)** — no npm fix is published (SheetJS distributes fixes via
  its own CDN). It runs **in the browser only**, on the import/export screen,
  parsing a file the authenticated admin user themselves selected — a trusted
  input path. Low exploitability; revisit if a maintained fork is adopted.

None of these block go-live; they are routine maintenance items. Re-run
`npm audit` periodically and apply non-breaking fixes.

## Operational responsibilities (the deployer)

The application cannot enforce these — they belong to the VPS operator:

- **TLS** — terminate HTTPS in front of the `web` container (Caddy, or nginx +
  certbot). `secure` cookies require it.
- **Strong secrets** — set strong unique values in `.env` (`POSTGRES_PASSWORD`,
  `SEED_ADMIN_PASSWORD`, SMTP/LINE credentials).
- **Change the seeded admin password** on first login (forced by the app).
- **Backups** — schedule `scripts/backup.sh` and copy `/backups` off-site.
- **OS & Docker patching** — keep the host and base images current.
