# Phase 9: Settings, Audit, Import/Export — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Builds on Phases 1–8.

**Goal:** Add company-settings management, a server-side audit log of every mutation, and Excel import/export for bulk data — products, customers, and stock.

**Architecture:** The `app_settings` table already exists (Phase 5); this phase adds a key-allowlisted `PUT /api/settings` and the management screen. The audit log is a single Fastify `onResponse` hook that, after any successful mutating request, writes one `audit_log` row — who (`request.user`), what (method + route path), and the status — so coverage is automatic and no route needs touching. Import/export keeps the API dependency-free: export endpoints return JSON rows and import endpoints accept JSON rows and validate each one server-side (the spec's hard requirement), while the **web** app does the actual `.xlsx` conversion with SheetJS — exactly the split the legacy demo used. Imports are best-effort per row: valid rows are created, bad rows come back in an error report.

**Tech Stack:** Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, Vitest, plus **xlsx** (SheetJS) on the web only.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§5 data model, §8.4 security, §11 data migration, §13 phase 9)

---

## Data Model

New model:
- **`AuditLog`** — `id`, `userId?` (null for unauthenticated actions such as login), `method`, `path` (the route pattern, e.g. `/api/sales/:id/void`), `statusCode`, `createdAt`.

Back-relation: `User.auditLogs`.

`app_settings` is unchanged (Phase 5).

---

## Permissions (added to the Phase 8 seed catalog)

| key | description (th) | granted to |
|-----|------------------|-----------|
| `settings.manage` | แก้ไขการตั้งค่าระบบ | owner, admin |
| `audit.view` | ดูบันทึกการใช้งาน | owner, admin |
| `data.manage` | นำเข้า/ส่งออกข้อมูล | owner, admin |

All three are admin-level — granted only via the `owner`/`admin` `ALL` set, so the `manager`/`cashier`/`account` permission lists are unchanged (the `cashier.permissions` count stays 13).

---

## API surface

| Method & path | Permission | Notes |
|---------------|-----------|-------|
| `PUT /api/settings` | `settings.manage` | body `{ <key>: <value> }`; only allowlisted keys |
| `GET /api/audit-log` | `audit.view` | recent entries, newest first |
| `GET /api/export/products` | `data.manage` | JSON rows |
| `GET /api/export/customers` | `data.manage` | JSON rows |
| `GET /api/export/stock` | `data.manage` | JSON rows |
| `POST /api/import/products` | `data.manage` | `{ rows: [...] }` → `{ created, errors }` |
| `POST /api/import/customers` | `data.manage` | `{ rows: [...] }` → `{ created, errors }` |
| `POST /api/import/stock` | `data.manage` | `{ rows: [...] }` → `{ created, errors }` (`IMPORT` movements) |

---

## Task 1: Prisma schema — AuditLog + migration

**Files:** Modify `apps/api/prisma/schema.prisma`.

- [ ] **Step 1:** Add the `AuditLog` model and the `User.auditLogs` back-relation.
- [ ] **Step 2:** Migrate: `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name audit_log && cd ../..` — ends with `Your database is now in sync`.
- [ ] **Step 3:** Commit: `feat(api): add audit-log model and migration`.

## Task 2: Seed — settings/audit/data permissions

**Files:** Modify `apps/api/src/seed/catalog.ts`.

- [ ] **Step 1:** Append `settings.manage`, `audit.view`, `data.manage` to `PERMISSIONS`. The role arrays need no change — `owner`/`admin` pick them up via `ALL`.
- [ ] **Step 2:** Run the API suite — PASS (the seed test's `permission.count()` follows `PERMISSIONS.length`; the `cashier` count is unchanged). Apply to the dev DB via `npx prisma db seed`.
- [ ] **Step 3:** Commit: `feat(api): seed settings, audit, and data permissions`.

## Task 3: Audit log — onResponse hook + route — TDD

**Files:** Create `apps/api/src/audit/plugin.ts`, `apps/api/src/routes/audit.ts` + `audit.test.ts`; modify `apps/api/src/app.ts`, `apps/api/src/test-helpers/auth.ts`.

- [ ] **Step 1:** Extend `resetAuthTables` — clear `auditLog` (before `user`, FK-safe).
- [ ] **Step 2:** Write `audit.test.ts` — after an authenticated `POST` (e.g. creating a category) an `audit_log` row exists carrying the user id, method `POST`, and a 2xx `statusCode`; a `GET` writes **no** audit row; `GET /api/audit-log` requires `audit.view` and lists entries.
- [ ] **Step 3:** Run — FAIL.
- [ ] **Step 4:** Implement `audit/plugin.ts` — a `fastify-plugin` adding an `onResponse` hook: for `POST`/`PATCH`/`PUT`/`DELETE` with `statusCode < 400`, insert an `audit_log` row (`request.user?.id ?? null`, method, `request.routeOptions?.url ?? request.url`, status); wrap the insert in try/catch so an audit failure never affects the response. Implement `routes/audit.ts` — `GET /api/audit-log` (`audit.view`), newest first, include the user's username. Register the plugin (early) and route in `app.ts`.
- [ ] **Step 5:** Run — PASS. Commit: `feat(api): add audit logging via onResponse hook`.

## Task 4: Settings update route — TDD

**Files:** Modify `apps/api/src/routes/settings.ts` + create `settings.test.ts`.

- [ ] **Step 1:** Write `settings.test.ts` — `PUT /api/settings` with `settings.manage` updates a known key and `GET /api/settings` reflects it; an unknown key → `400 UNKNOWN_KEY`; a user without `settings.manage` → 403.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Add `PUT /api/settings` to `settingsRoutes` (`settings.manage`): the body is a `{ key: value }` map; reject any key not in the `APP_SETTINGS` allowlist (`UNKNOWN_KEY`); `upsert` each into `appSetting`; return the full settings map.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add settings update route`.

## Task 5: Export routes — TDD

**Files:** Create `apps/api/src/routes/export.ts` + `export.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `export.test.ts` — `GET /api/export/products` with `data.manage` returns the products as JSON rows (`sku`, `name`, `category`, `basePrice`, `isSofa`); `customers` and `stock` likewise; without `data.manage` → 403.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `exportRoutes` (`data.manage`): `/products` (join the category name), `/customers` (`name`, `phone`, `email`, `pointsBalance`, `lifetimeSpend`), `/stock` (`sku`, `productName`, `branchCode`, `quantity`). Register in `app.ts`.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add data export routes`.

## Task 6: Import routes — TDD

**Files:** Create `apps/api/src/routes/import.ts` + `import.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `import.test.ts` — `POST /api/import/products` with `{ rows }` creates valid products (auto-creating their category by name) and returns `{ created, errors }` with a row-level error for a duplicate `sku`; `POST /api/import/customers` likewise on `phone`; `POST /api/import/stock` applies `IMPORT` stock movements and reports an unknown `sku`/`branchCode` as a row error; without `data.manage` → 403.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `importRoutes` (`data.manage`). Each endpoint iterates rows best-effort: validate, create the valid ones, collect `{ row, message }` for failures. Products — upsert the category by name, create the product (duplicate `sku` → error). Customers — create (duplicate `phone` → error). Stock — resolve product by `sku` and branch by `code`, then `applyStockMovement(reason: "IMPORT")`; unknown references → row error. Return `{ created, errors }`. Register in `app.ts`.
- [ ] **Step 4:** Run — PASS; run the full API suite and `npm run build --workspace apps/api`. Commit: `feat(api): add data import routes with per-row validation`.

## Task 7: Web — settings & audit views

**Files:** Create `apps/web/src/api/admin.ts`, `apps/web/src/views/SettingsView.vue`, `apps/web/src/views/AuditLogView.vue`; add i18n keys.

- [ ] **Step 1:** Add i18n keys (`settings`, `auditLog`, `importExport`, `export`, `import`, `value`, `result`) to `th.ts`/`en.ts`.
- [ ] **Step 2:** Create `api/admin.ts` — `fetchSettings`/`updateSettings`, `fetchAuditLog`, `exportData`, `importData` typed helpers.
- [ ] **Step 3:** Create `SettingsView.vue` — an editable form of the company settings, saved with `updateSettings`.
- [ ] **Step 4:** Create `AuditLogView.vue` — a table of recent audit entries (time, user, method, path, status).
- [ ] **Step 5:** Commit: `feat(web): add settings and audit-log views`.

## Task 8: Web — import/export view (SheetJS)

**Files:** Create `apps/web/src/views/ImportExportView.vue`; modify `apps/web/package.json`.

- [ ] **Step 1:** Add `xlsx` to `apps/web` dependencies; run `npm install`.
- [ ] **Step 2:** Create `ImportExportView.vue` — for products / customers / stock: an **Export** button that fetches the JSON rows and downloads them as an `.xlsx` via SheetJS, and an **Import** file input that reads the chosen `.xlsx` with SheetJS, posts the rows, and shows the `{ created, errors }` result.
- [ ] **Step 3:** Commit: `feat(web): add Excel import/export view`.

## Task 9: Web — router & nav wiring + build

**Files:** Modify `apps/web/src/router/index.ts`, `apps/web/src/App.vue`.

- [ ] **Step 1:** Add routes `/settings` (`settings.manage`), `/audit-log` (`audit.view`), `/import-export` (`data.manage`); lazy-import.
- [ ] **Step 2:** Add permission-gated nav `RouterLink`s.
- [ ] **Step 3:** Run `npm test --workspace apps/web` and `npm run build --workspace apps/web` (exit 0).
- [ ] **Step 4:** Manual end-to-end smoke check against a live API: edit a company setting, export products, import a small product set and confirm the result + error report, and confirm a mutation produced an audit-log row.
- [ ] **Step 5:** Commit: `feat(web): wire settings, audit, and import/export routes`.

---

## Self-Review Notes

- **Spec coverage (§5, §8.4, §11, §13):** `audit_log` with automatic per-mutation coverage ✓ (Task 3); `app_settings` management ✓ (Task 4 — the table/seed/read were Phase 5); Excel import of products/customers/stock with **server-side validation** ✓ (Task 6) and export ✓ (Task 5). The `IMPORT` stock-movement reason declared back in Phase 3 is finally used.
- **Audit approach:** a single `onResponse` hook gives complete, tamper-evident coverage of every successful mutation without scattering log calls through the routes; it records the route *pattern* (not the id-filled URL) and never logs request bodies, so passwords never reach the log.
- **Excel split:** the API speaks JSON and validates every imported row server-side; the browser does the `.xlsx` ⇄ JSON conversion with SheetJS — the same architecture as the legacy demo, and it keeps the API free of file-upload/binary dependencies while still meeting the spec's server-validation requirement.
- **Imports are best-effort:** valid rows are created and invalid rows are returned in an error report rather than failing the whole batch — the right behaviour for migrating messy initial data.
- **Out of scope:** production hardening, automated backups, the real data migration run, and go-live are Phase 10.
- **Test isolation:** `resetAuthTables` gains the `auditLog` delete (before `user`); `fileParallelism: false` keeps the shared-DB suites serial. The audit `onResponse` hook writes a row for the test suite's own mutating requests — harmless, and cleared each `beforeEach`.

## Next Phase

Phase 10 (Hardening & Go-live — automated backups, security review, real data migration, launch) gets its own plan once Phase 9 is complete and reviewed.
