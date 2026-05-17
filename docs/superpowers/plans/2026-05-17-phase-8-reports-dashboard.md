# Phase 8: Reports & Dashboard — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Builds on Phases 1–7.

**Goal:** Add end-of-day **Z-reports** per branch, a scheduled **daily report** sent over Email and LINE (with a send log), an overview **dashboard**, and **real-time SSE** push of sale/stock/delivery events to the web app.

**Architecture:** A Z-report is an immutable snapshot — `generateZReport` aggregates a branch's `COMPLETED` sales for a business date (gross, VAT, discount, a payment-method breakdown, plus voided totals) into one `z_reports` row, unique per branch+date. The daily report has a pure `buildDailyReport` that renders an all-branches text summary; `runDailyReport` sends it through Email (nodemailer/SMTP) and LINE (Messaging API) adapters that **skip gracefully** when their credentials are absent, logging every attempt to `daily_report_history`; a `node-cron` job runs it nightly. The dashboard is one aggregation endpoint. Real-time uses an in-process event bus: route handlers emit `sale.completed` / `stock.changed` / `delivery.updated` **after** their transaction commits, and a `GET /api/events` SSE endpoint streams them to subscribed browsers, where a Pinia store triggers a refresh.

**Tech Stack:** Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, Vitest, plus **nodemailer** (SMTP) and **node-cron** (scheduling). LINE push uses the global `fetch`.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§5, §8.2 SSE, §8.3 daily report, §13 phase 8)

---

## Data Model

New enums:
- **`ReportChannel`** — `EMAIL`, `LINE`.
- **`ReportSendStatus`** — `SENT`, `FAILED`, `SKIPPED`.

New models:
- **`ZReport`** — `id`, `branchId`, `businessDate` (`DateTime @db.Date`), `generatedById`, `salesCount`, `grossTotal`, `vatTotal`, `discountTotal`, `cashTotal`, `transferTotal`, `cardTotal`, `voidedCount`, `voidedTotal`, `createdAt`. `@@unique([branchId, businessDate])`.
- **`DailyReportHistory`** — `id`, `channel` (`ReportChannel`), `status` (`ReportSendStatus`), `recipient?`, `content` (String), `error?`, `createdAt`.

Back-relations: `Branch.zReports`, `User.zReportsGenerated`.

---

## Permissions (added to the Phase 7 seed catalog)

| key | description (th) | granted to |
|-----|------------------|-----------|
| `reports.view` | ดูรายงานและแดชบอร์ด | owner, admin, manager, cashier, account |
| `reports.generate` | ออก Z-report และส่งรายงานประจำวัน | owner, admin, manager, cashier |

`.env.example` gains optional report-delivery vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `REPORT_EMAIL_TO`, `LINE_CHANNEL_TOKEN`, `LINE_TO`.

---

## API surface

| Method & path | Permission | Notes |
|---------------|-----------|-------|
| `POST /api/z-reports` | `reports.generate` | `{ branchId, businessDate }`; 409 if already run |
| `GET /api/z-reports` | `reports.view` | branch-scoped |
| `GET /api/z-reports/:id` | `reports.view` | |
| `GET /api/dashboard` | `reports.view` | today's totals, outstanding, deliveries, low stock — branch-scoped |
| `POST /api/daily-report/run` | `reports.generate` | manual trigger; returns the send log |
| `GET /api/daily-report/history` | `reports.view` | recent send log |
| `GET /api/events` | authenticated | SSE stream of app events |

---

## Task 1: Prisma schema — report models + migration

**Files:** Modify `apps/api/prisma/schema.prisma`.

- [ ] **Step 1:** Add the two enums and the `ZReport`/`DailyReportHistory` models, plus the `Branch.zReports` and `User.zReportsGenerated` back-relations.
- [ ] **Step 2:** Migrate: `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name reports && cd ../..` — ends with `Your database is now in sync`.
- [ ] **Step 3:** Commit: `feat(api): add Z-report and daily-report-history models and migration`.

## Task 2: Seed — reports permissions

**Files:** Modify `apps/api/src/seed/catalog.ts`, `apps/api/src/seed/index.test.ts`, `.env.example`.

- [ ] **Step 1:** Append `reports.view`, `reports.generate` to `PERMISSIONS`; grant `reports.view` to all five roles, `reports.generate` to `manager`/`cashier`.
- [ ] **Step 2:** Append the optional report-delivery vars (commented or blank) to `.env.example`.
- [ ] **Step 3:** Update `index.test.ts` — `cashier.permissions` length becomes `13`.
- [ ] **Step 4:** Run the API suite — PASS. Apply to dev DB via `npx prisma db seed`.
- [ ] **Step 5:** Commit: `feat(api): seed reports permissions`.

## Task 3: Z-report service — TDD

**Files:** Create `apps/api/src/reports/zreport.ts` + `zreport.test.ts`.

- [ ] **Step 1:** Write `zreport.test.ts` against a real DB (reuse a checkout fixture). Cases:
  - `generateZReport` for a branch+date aggregates that day's `COMPLETED` sales — `salesCount`, `grossTotal` (Σ total), `vatTotal`, `discountTotal` — and the payment-method breakdown into `cashTotal`/`transferTotal`/`cardTotal`.
  - a voided sale is excluded from the gross totals but counted in `voidedCount`/`voidedTotal`.
  - generating twice for the same branch+date throws `ZReportError` `ALREADY_EXISTS`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `zreport.ts` — `ZReportError` with a `code`; `generateZReport(prisma, { branchId, businessDate, generatedById })`: compute the UTC day window `[date, date+24h)`; aggregate `sale` rows (`COMPLETED` for the gross figures, `VOIDED` for the voided figures) and `payment.groupBy({ by: ["method"] })` for sales in the window; `create` the `ZReport`, surfacing the unique-constraint violation as `ALREADY_EXISTS`.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add Z-report generation service`.

## Task 4: Z-report & dashboard routes — TDD

**Files:** Create `apps/api/src/routes/reports.ts` + `.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `reports.test.ts` — `POST /api/z-reports` with `reports.generate` returns 201; without it → 403; a second run for the same branch+date → `409 ALREADY_EXISTS`; `GET /api/z-reports` lists branch-scoped; `GET /api/dashboard` returns `todaySalesCount`/`todaySalesTotal`/`outstandingTotal`/`pendingDeliveries`/`lowStockCount`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `reportRoutes`: `POST /api/z-reports` (`reports.generate`, branch-scoped check) → `generateZReport`, map `ZReportError` → 409/400; `GET /api/z-reports` + `/:id` (`reports.view`, branch-scoped); `GET /api/dashboard` (`reports.view`) aggregating today's `COMPLETED` sales count/total, Σ `outstanding`, active-delivery count, and stock levels below a low-stock threshold — all branch-scoped. Register in `app.ts`.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add Z-report and dashboard routes`.

## Task 5: Daily report — build, send, schedule — TDD

**Files:** Create `apps/api/src/reports/daily.ts`, `notify.ts`, `schedule.ts`, `daily.test.ts`; create `apps/api/src/routes/daily-report.ts`; modify `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/package.json`.

- [ ] **Step 1:** Add `nodemailer` (dep) + `@types/nodemailer` (dev) + `node-cron` (dep) to `apps/api/package.json`; run `npm install`.
- [ ] **Step 2:** Write `daily.test.ts` — `buildDailyReport(prisma, date)` returns a `{ date, text }` whose `text` contains the day's branch sales totals; `runDailyReport(prisma, date)` writes one `daily_report_history` row per channel and — with no SMTP/LINE env configured — both rows have status `SKIPPED`.
- [ ] **Step 3:** Run — FAIL.
- [ ] **Step 4:** Implement:
  - `daily.ts` — `buildDailyReport` queries each branch's `COMPLETED` sales for the day and renders a Thai text summary; `runDailyReport` builds the text, calls the Email + LINE adapters, and records a `DailyReportHistory` row per channel.
  - `notify.ts` — `sendEmail(subject, text)` (nodemailer; `SKIPPED` when `SMTP_HOST` is unset) and `sendLine(text)` (`fetch` to the LINE push API; `SKIPPED` when `LINE_CHANNEL_TOKEN`/`LINE_TO` are unset); each returns `{ status, recipient?, error? }`.
  - `schedule.ts` — `startDailyReportSchedule(prisma)` registers a `node-cron` nightly job.
  - `daily-report.ts` route — `POST /api/daily-report/run` (`reports.generate`) and `GET /api/daily-report/history` (`reports.view`).
  - `server.ts` — call `startDailyReportSchedule(prisma)` after `listen`.
- [ ] **Step 5:** Run — PASS. Commit: `feat(api): add daily report build, Email/LINE send, and schedule`.

## Task 6: Real-time SSE — event bus, endpoint, emits — TDD

**Files:** Create `apps/api/src/events/bus.ts` + `bus.test.ts`, `apps/api/src/routes/events.ts`; modify `apps/api/src/app.ts`, `apps/api/src/routes/sales.ts`, `stock.ts`, `transfers.ts`, `deliveries.ts`.

- [ ] **Step 1:** Write `bus.test.ts` — `onAppEvent` receives an event published with `emitAppEvent`; the unsubscribe function stops further delivery.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `bus.ts` — a module-singleton `EventEmitter`; `emitAppEvent({ type, payload })` and `onAppEvent(fn): () => void`. Create `events.ts` — `GET /api/events` (`app.authenticate`): set the `text/event-stream` headers, write each event as `data: <json>\n\n` via `reply.raw`, and unsubscribe on request close. Register in `app.ts`.
- [ ] **Step 4:** Add post-commit `emitAppEvent` calls: `sale.completed` after a successful `POST /api/sales`; `stock.changed` after stock adjust and transfer; `delivery.updated` after delivery create and status change.
- [ ] **Step 5:** Run — PASS; run the full API suite and `npm run build --workspace apps/api`. Commit: `feat(api): add real-time event bus and SSE endpoint`.

## Task 7: Web — reports API & dashboard view

**Files:** Create `apps/web/src/api/reports.ts`, `apps/web/src/views/DashboardView.vue`; add i18n keys.

- [ ] **Step 1:** Add i18n keys (`dashboard`, `reports`, `zReport`, `generate`, `dailyReport`, `today`, `lowStock`, `pendingDeliveries`, `businessDate`) to `th.ts`/`en.ts`.
- [ ] **Step 2:** Create `api/reports.ts` — `Dashboard`, `ZReport` interfaces; `fetchDashboard`, `fetchZReports`, `fetchZReport`, `generateZReport`, `runDailyReport`.
- [ ] **Step 3:** Create `DashboardView.vue` — cards for today's sales count/total, outstanding total, pending deliveries, low-stock count.
- [ ] **Step 4:** Commit: `feat(web): add reports API and dashboard view`.

## Task 8: Web — Z-report views

**Files:** Create `apps/web/src/views/ZReportListView.vue`, `apps/web/src/views/ZReportDetailView.vue`.

- [ ] **Step 1:** `ZReportListView.vue` — a table of Z-reports (branch, business date, sales count, gross) plus, for `reports.generate` users, a generate form (branch + date).
- [ ] **Step 2:** `ZReportDetailView.vue` — the full figure breakdown for one Z-report (gross/VAT/discount, cash/transfer/card, voided).
- [ ] **Step 3:** Commit: `feat(web): add Z-report list and detail views`.

## Task 9: Web — SSE client, routing, build

**Files:** Create `apps/web/src/stores/events.ts`; modify `apps/web/src/App.vue`, `apps/web/src/views/DashboardView.vue`, `apps/web/src/router/index.ts`.

- [ ] **Step 1:** Create the `events` Pinia store — `connect()` opens an `EventSource("/api/events")` and updates a reactive `lastEvent`/`tick`; `App.vue` calls `connect()` once the user is signed in.
- [ ] **Step 2:** `DashboardView.vue` watches the store's `tick` and reloads, so a sale rung elsewhere refreshes the dashboard live.
- [ ] **Step 3:** Add routes `/dashboard` (`reports.view`), `/z-reports` (`reports.view`), `/z-reports/:id` (`reports.view`); add nav links; lazy-import.
- [ ] **Step 4:** Run `npm test --workspace apps/web` and `npm run build --workspace apps/web` (exit 0).
- [ ] **Step 5:** Manual end-to-end smoke check against a live API: open the dashboard, ring up a sale and confirm an SSE event arrives, generate a Z-report, run the daily report and confirm two `SKIPPED` history rows.
- [ ] **Step 6:** Commit: `feat(web): add SSE client and wire reports routes`.

---

## Self-Review Notes

- **Spec coverage (§5, §8.2, §8.3, §13):** `z_reports` immutable per branch+date ✓ (Tasks 1, 3); `daily_report_history` with real Email/LINE send ✓ (Task 5); the dashboard ✓ (Tasks 4, 7); SSE push of `sale.completed`/`stock.changed`/`delivery.updated` ✓ (Task 6). `audit_log` (also in spec §5's "reports/system" group) belongs to Phase 9.
- **Real sending vs. testability:** the Email/LINE adapters genuinely send when `SMTP_*` / `LINE_*` env vars are configured; with no credentials they record a `SKIPPED` history row instead of failing. Tests cover report building and history recording; the actual third-party I/O is exercised only in a configured deployment.
- **Business date:** Z-reports and the dashboard use UTC day windows for deterministic queries and tests; a deployment wanting Asia/Bangkok day boundaries would shift the window — noted as a known v1 simplification.
- **SSE:** events are emitted by route handlers **after** the transaction commits (never inside it), so a rolled-back checkout pushes nothing. The bus is unit-tested; the streaming endpoint is verified by the live smoke test (Fastify `inject` cannot stream).
- **Out of scope:** the audit log and the settings/import-export screens are Phase 9; production hardening and go-live are Phase 10.
- **Test isolation:** `resetAuthTables` gains `zReport` and `dailyReportHistory` deletes in FK-safe order; `fileParallelism: false` keeps the shared-DB suites serial.

## Next Phase

Phase 9 (Settings, Audit, Import/Export) gets its own plan once Phase 8 is complete and reviewed.
