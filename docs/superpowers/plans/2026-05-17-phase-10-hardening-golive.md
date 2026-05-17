# Phase 10: Hardening & Go-live — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD where code is involved. Steps use checkbox (`- [ ]`) syntax for tracking. Builds on Phases 1–9 — the final phase.

**Goal:** Make the system production-safe and launch-ready — validate configuration on startup, add HTTP security headers and global rate limiting, return structured errors without leaking internals, shut down gracefully, fix the production deploy gaps, provide real backup/restore scripts, complete a security review, and write the go-live runbook.

**Architecture:** A `loadConfig` reads and validates required environment at startup so the API fails fast on misconfiguration. `@fastify/helmet` adds security headers and rate-limiting becomes global (login keeps its stricter cap). A `setErrorHandler` maps thrown/validation errors to the `{ code, message }` shape used everywhere else and never leaks a stack trace in production; a `setNotFoundHandler` does the same for unknown routes. `server.ts` wires the config and closes Fastify + Prisma cleanly on `SIGTERM`/`SIGINT` so the container restart policy is graceful. The production compose file gains the missing `NODE_ENV=production` (which turns on `secure` session cookies) and an API healthcheck; nginx gains security headers. `scripts/backup.sh` / `restore.sh` make the pg_dump cycle real. A security review and a go-live runbook close the project.

**Tech Stack:** Fastify 4, Prisma 5, Vitest, plus **@fastify/helmet**. No web-app changes.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§8.4 security, §10 deploy & backup, §13 phase 10)

---

## Task 1: Startup config validation — TDD

**Files:** Create `apps/api/src/config.ts` + `config.test.ts`.

- [ ] **Step 1:** Write `config.test.ts` — `loadConfig({ DATABASE_URL: "x" })` returns `databaseUrl: "x"`, `port: 3000` (default), `isProduction: false`; `loadConfig({ DATABASE_URL: "x", NODE_ENV: "production", API_PORT: "8080" })` → `isProduction: true`, `port: 8080`; `loadConfig({})` throws (missing `DATABASE_URL`).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `config.ts` — `loadConfig(env = process.env): AppConfig` with `databaseUrl` (required — throw a clear error if absent), `port` (`API_PORT` ?? 3000), `nodeEnv`, `isProduction` (`NODE_ENV === "production"`).
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add startup configuration validation`.

## Task 2: Security headers & global rate limit — TDD

**Files:** Modify `apps/api/package.json` (add `@fastify/helmet`), `apps/api/src/app.ts`, `apps/api/src/auth/plugin.ts`; create `apps/api/src/app.security.test.ts`.

- [ ] **Step 1:** Add `@fastify/helmet` (`^11.1.1`) to `apps/api/package.json`; run `npm install`.
- [ ] **Step 2:** Write `app.security.test.ts` — a `/health` response carries `x-content-type-options: nosniff` and `x-frame-options`.
- [ ] **Step 3:** Run — FAIL.
- [ ] **Step 4:** Register `@fastify/helmet` in `buildApp` (before routes). In `auth/plugin.ts` change the rate-limit registration from `{ global: false }` to a global limit (`max: 300`, `timeWindow: "1 minute"`) — the login route keeps its per-route `max: 5`.
- [ ] **Step 5:** Run — PASS. Commit: `feat(api): add security headers and global rate limiting`.

## Task 3: Structured error & not-found handlers — TDD

**Files:** Create `apps/api/src/errors.ts`; modify `apps/api/src/app.ts`; create `apps/api/src/app.errors.test.ts`.

- [ ] **Step 1:** Write `app.errors.test.ts` — an unknown route → `404 { code: "NOT_FOUND" }`; a schema-validated route receiving a bad body → `400 { code: "VALIDATION" }` (e.g. `POST /api/auth/login` with an empty body).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Create `errors.ts` — `registerErrorHandlers(app)`: a `setErrorHandler` that maps `err.validation` → `400 { code: "VALIDATION", message }`, a `statusCode < 500` → that status with `{ code: err.code ?? "ERROR", message }`, and anything else → `500 { code: "INTERNAL", message: "เกิดข้อผิดพลาดภายในระบบ" }` (logged, never leaking the stack); a `setNotFoundHandler` returning `404 { code: "NOT_FOUND" }`. Call it inside `buildApp`.
- [ ] **Step 4:** Run — PASS; run the full API suite (the normalized validation shape must not regress existing tests). Commit: `feat(api): add structured error and not-found handlers`.

## Task 4: Graceful shutdown & config wiring

**Files:** Modify `apps/api/src/server.ts`.

- [ ] **Step 1:** Use `loadConfig()` for the port; on `SIGTERM`/`SIGINT`, `await app.close()` then `await prisma.$disconnect()` and exit 0 (so the container stops cleanly under its restart policy). Keep `startDailyReportSchedule`.
- [ ] **Step 2:** Verify the API still boots: `cd apps/api && DATABASE_URL=... npx tsx src/server.ts` starts and `GET /health` responds, then stop it.
- [ ] **Step 3:** Commit: `feat(api): validate config and shut down gracefully`.

## Task 5: Production deploy hardening

**Files:** Modify `docker-compose.prod.yml`, `nginx/nginx.conf`.

- [ ] **Step 1:** In `docker-compose.prod.yml` add `NODE_ENV: production` to the `api` service environment (this is what turns on `secure` session cookies — currently missing) and an API healthcheck (`node -e` fetch of `/health`); make the `web` service `depends_on` the api `service_healthy`.
- [ ] **Step 2:** In `nginx/nginx.conf` add `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` response headers, and a basic request-body size limit.
- [ ] **Step 3:** Commit: `chore(deploy): harden production compose and nginx config`.

## Task 6: Backup & restore scripts

**Files:** Create `scripts/backup.sh`, `scripts/restore.sh`; modify `docs/DEPLOY.md`.

- [ ] **Step 1:** `scripts/backup.sh` — `pg_dump` the database through `docker compose -f docker-compose.prod.yml exec -T postgres`, gzip to a timestamped file under a `BACKUP_DIR` (default `/backups`), and prune dumps older than 14 days. `scripts/restore.sh` — restore a chosen gzipped dump (with a confirmation prompt). Both `set -euo pipefail`; make them executable.
- [ ] **Step 2:** Update `docs/DEPLOY.md` to reference the scripts instead of the inline cron one-liner.
- [ ] **Step 3:** Commit: `chore(ops): add backup and restore scripts`.

## Task 7: Security review

**Files:** Create `docs/SECURITY.md`; fix any code findings.

- [ ] **Step 1:** Review against the spec §8.4 checklist and OWASP basics: argon2 password hashing; opaque SHA-256-hashed session tokens; `httpOnly`/`secure`/`sameSite` cookies; server-enforced RBAC and branch scoping; login + global rate limiting; Prisma (SQL-injection-safe) and Vue (XSS-safe); secrets only in `.env` (confirm `.env` is git-ignored — it is); the audit log never stores request bodies; the error handler never leaks stacks in production. Run `npm audit` and note the result.
- [ ] **Step 2:** Fix any concrete code finding uncovered (and add a test if it is testable).
- [ ] **Step 3:** Write `docs/SECURITY.md` — the checklist with its verification status, the dependency-audit note, and the operational responsibilities left to the deployer (TLS, strong secrets, OS patching, off-site backup copies).
- [ ] **Step 4:** Run the full API suite. Commit: `docs: add security review`.

## Task 8: Go-live runbook & final verification

**Files:** Create `docs/GO-LIVE.md`.

- [ ] **Step 1:** Write `docs/GO-LIVE.md` — a launch runbook: pre-launch checklist (strong `.env` secrets, TLS in front, backups scheduled, `runSeed` applied), the deploy command, the **real data migration** procedure (export templates, then bulk-import products → customers → stock through the Phase 9 import screen, reviewing the per-row error report), a post-deploy smoke-test checklist (log in, change the seeded admin password, ring a sale, void it, book a delivery, generate a Z-report), the backup/restore drill, and the rollback procedure.
- [ ] **Step 2:** Run the full test suite (`npm test`) and both builds (`npm run build` for api and web) — all green.
- [ ] **Step 3:** Manual end-to-end smoke check against a live API: confirm security headers are present, an unknown route returns the structured 404, and `/health` is OK.
- [ ] **Step 4:** Commit: `docs: add go-live runbook`. Push the branch.

---

## Self-Review Notes

- **Spec coverage (§8.4, §10, §13):** automated backup — real `backup.sh`/`restore.sh` + cron ✓ (Task 6); security review ✓ (Task 7); the real data-migration procedure is documented and uses the Phase 9 Excel import ✓ (Task 8); go-live runbook ✓ (Task 8). Hardening: config validation (Task 1), security headers + rate limiting (Task 2), structured errors (Task 3), graceful shutdown (Task 4), and the production `NODE_ENV`/healthcheck/nginx fixes (Task 5).
- **Real bug fixed:** the production compose file never set `NODE_ENV=production`, so session cookies were issued without the `secure` flag in production — Task 5 corrects this.
- **No fake data:** the data migration is a documented operational procedure (the deployer imports their real product/customer/stock data); seeding remains roles/permissions/sofa-materials/settings/admin only, per spec §11.
- **Scope:** TLS termination, off-site backup copying, and OS patching are operational responsibilities of the deployer — documented in `SECURITY.md`/`GO-LIVE.md` rather than coded, since they live outside the application.
- **No web changes:** hardening is server-side and operational; the Vue app is unchanged.

## Project complete

Phase 10 closes the production rebuild: Phases 1–10 took the vanilla-JS demo to a tested Fastify + Prisma + PostgreSQL + Vue 3 system covering auth/RBAC, catalog & stock, customers & loyalty, POS & VAT, receipts/quotations/deposits, delivery, reports/dashboard/SSE, settings/audit/import-export, and production hardening.
