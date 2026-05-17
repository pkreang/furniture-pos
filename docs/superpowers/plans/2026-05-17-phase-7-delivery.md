# Phase 7: Delivery — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Builds on Phases 1–6.

**Goal:** Add the delivery subsystem — delivery zones (with a fee), channels (in-house team vs. third-party courier), in-house teams and their drivers, and a `Delivery` per sale that moves through a status state machine with a full transition history — plus the management and scheduling UI.

**Architecture:** Delivery config — zones, channels, teams, drivers — are simple reference tables managed through CRUD routes. A `Delivery` attaches one-to-one to a `Sale`: it snapshots the zone fee, records the recipient and address, and starts in `PENDING`. Status changes go through a single `changeDeliveryStatus` service guarded by a pure `canTransition` state machine (`PENDING → SCHEDULED → IN_TRANSIT → DELIVERED`, with `FAILED`/`CANCELLED` branches); every change appends a `delivery_status_history` row, so the delivery carries its own audit trail. Branch-scoped roles see and act on only the deliveries whose sale belongs to their branch. The web app gains a delivery-config screen, a booking form, a date-grouped delivery list (the scheduling calendar), and a detail view with the status timeline.

**Tech Stack:** Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, vue-router 4, Pinia 2, Vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§5 data model, §13 phase 7)

---

## Data Model

New enums:
- **`DeliveryChannelType`** — `IN_HOUSE`, `COURIER`.
- **`DeliveryStatus`** — `PENDING`, `SCHEDULED`, `IN_TRANSIT`, `DELIVERED`, `FAILED`, `CANCELLED`.

New models (`@@map` snake_case, consistent with Phases 1–6):
- **`DeliveryZone`** — `id`, `name` (unique), `fee` (Int, default 0), `createdAt`.
- **`DeliveryChannel`** — `id`, `name` (unique), `type` (`DeliveryChannelType`), `createdAt`.
- **`DeliveryTeam`** — `id`, `name`, `branchId`, `createdAt`.
- **`Driver`** — `id`, `name`, `phone?`, `teamId`, `isActive` (Boolean, default true), `createdAt`.
- **`Delivery`** — `id`, `saleId` (unique — 1:1 with the sale), `zoneId`, `channelId`, `teamId?`, `driverId?`, `status` (`DeliveryStatus`, default `PENDING`), `scheduledDate` (DateTime), `timeSlot?` (String), `addressText`, `recipientName?`, `recipientPhone?`, `fee` (Int — snapshot of the zone fee), `note?`, `createdAt`.
- **`DeliveryStatusHistory`** — `id`, `deliveryId`, `status`, `note?`, `changedById?`, `createdAt`.

Back-relations: `Sale.delivery`, `Branch.deliveryTeams`, `User.deliveryStatusChanges`.

---

## Delivery status state machine (pure module `apps/api/src/delivery/state.ts`)

```typescript
import type { DeliveryStatus } from "@prisma/client";

export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING:    ["SCHEDULED", "CANCELLED"],
  SCHEDULED:  ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "FAILED"],
  FAILED:     ["SCHEDULED", "CANCELLED"],
  DELIVERED:  [],
  CANCELLED:  [],
};

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}
```

---

## Permissions (added to the Phase 6 seed catalog)

| key | description (th) | granted to |
|-----|------------------|-----------|
| `delivery.view` | ดูงานจัดส่ง | owner, admin, manager, cashier, account |
| `delivery.manage` | จัดการงานจัดส่งและข้อมูลตั้งต้น | owner, admin, manager, cashier |

---

## API surface

| Method & path | Permission | Notes |
|---------------|-----------|-------|
| `GET/POST /api/delivery/zones`, `PATCH /api/delivery/zones/:id` | view / manage | |
| `GET/POST /api/delivery/channels` | view / manage | |
| `GET/POST /api/delivery/teams` | view / manage | |
| `GET/POST /api/delivery/drivers`, `PATCH /api/delivery/drivers/:id` | view / manage | |
| `POST /api/deliveries` | `delivery.manage` | books a delivery for a sale |
| `GET /api/deliveries` | `delivery.view` | branch-scoped; optional `?from=&to=&status=` |
| `GET /api/deliveries/:id` | `delivery.view` | with status history |
| `PATCH /api/deliveries/:id/status` | `delivery.manage` | state-machine guarded |

---

## Task 1: Prisma schema — delivery models + migration

**Files:** Modify `apps/api/prisma/schema.prisma`.

- [ ] **Step 1:** Add the two enums and six models in *Data Model*; add the `Sale.delivery`, `Branch.deliveryTeams`, `User.deliveryStatusChanges` back-relations.
- [ ] **Step 2:** Migrate: `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name delivery && cd ../..` — ends with `Your database is now in sync`.
- [ ] **Step 3:** Commit: `feat(api): add delivery models and migration`.

## Task 2: Seed — delivery permissions

**Files:** Modify `apps/api/src/seed/catalog.ts`, `apps/api/src/seed/index.test.ts`.

- [ ] **Step 1:** Append `delivery.view`, `delivery.manage` to `PERMISSIONS`; grant `delivery.view` to all five roles and `delivery.manage` to `manager`/`cashier`.
- [ ] **Step 2:** Update `index.test.ts` — `cashier.permissions` length becomes `11`.
- [ ] **Step 3:** Run the API suite — PASS. Apply to dev DB via `npx prisma db seed`.
- [ ] **Step 4:** Commit: `feat(api): seed delivery permissions`.

## Task 3: Delivery status state machine — TDD

**Files:** Create `apps/api/src/delivery/state.ts` + `state.test.ts`.

- [ ] **Step 1:** Write `state.test.ts` — pure unit tests: `canTransition("PENDING", "SCHEDULED")` true; `canTransition("PENDING", "DELIVERED")` false; `DELIVERED` and `CANCELLED` are terminal (no transition out); `IN_TRANSIT → FAILED` and `FAILED → SCHEDULED` true.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement `state.ts` as shown above. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit: `feat(api): add delivery status state machine`.

## Task 4: Delivery config routes — TDD

**Files:** Create `apps/api/src/routes/delivery-config.ts` + `.test.ts`; modify `apps/api/src/app.ts`, `apps/api/src/test-helpers/auth.ts`.

- [ ] **Step 1:** Extend `resetAuthTables` — clear `deliveryStatusHistory`, `delivery`, `driver`, `deliveryTeam`, `deliveryChannel`, `deliveryZone` in FK-safe order (before `sale`/`user`/`branch`).
- [ ] **Step 2:** Write `delivery-config.test.ts` — list endpoints require `delivery.view`; create/patch require `delivery.manage` (a viewer → 403); creating a zone/channel/team/driver returns 201; a driver can be deactivated via PATCH.
- [ ] **Step 3:** Run — FAIL.
- [ ] **Step 4:** Implement `deliveryConfigRoutes` — `GET/POST /api/delivery/zones` + `PATCH /:id`; `GET/POST /api/delivery/channels`; `GET/POST /api/delivery/teams`; `GET/POST /api/delivery/drivers` + `PATCH /:id`. Wrap unique violations (`P2002`) into `409 DUPLICATE`. Register in `app.ts`.
- [ ] **Step 5:** Run — PASS. Commit: `feat(api): add delivery config routes (zones, channels, teams, drivers)`.

## Task 5: Delivery service — TDD

**Files:** Create `apps/api/src/delivery/service.ts` + `service.test.ts`.

- [ ] **Step 1:** Write `service.test.ts` against a real DB (reuse a checkout fixture for the sale). Cases:
  - `createDelivery` makes a `Delivery` in `PENDING`, snapshots the zone `fee`, and writes an initial `PENDING` history row.
  - a second `createDelivery` for the same sale throws `DeliveryError` `ALREADY_EXISTS`.
  - `createDelivery` for a `VOIDED` sale throws `SALE_VOIDED`; for an unknown sale → `SALE_NOT_FOUND`.
  - `changeDeliveryStatus` to a legal next status updates the delivery and appends a history row; an illegal jump (e.g. `PENDING → DELIVERED`) throws `INVALID_TRANSITION`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `service.ts`:
  ```typescript
  export class DeliveryError extends Error {
    constructor(public code: string, message: string) { super(message); }
  }
  ```
  `createDelivery(args)` — one transaction: load the sale (`SALE_NOT_FOUND`; `SALE_VOIDED` if voided); load the zone for its `fee`; create the `Delivery` (status `PENDING`) and an initial `DeliveryStatusHistory` (`PENDING`); a duplicate `saleId` surfaces as `ALREADY_EXISTS`. `changeDeliveryStatus(deliveryId, to, changedById, note?)` — one transaction: load the delivery (`NOT_FOUND`); `canTransition(current, to)` else `INVALID_TRANSITION`; update `status`; append a history row; return the delivery with `history`.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add delivery booking and status-change service`.

## Task 6: Delivery routes — TDD

**Files:** Create `apps/api/src/routes/deliveries.ts` + `.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `deliveries.test.ts` — `POST /api/deliveries` with `delivery.manage` returns 201; a branch-scoped user booking a delivery for another branch's sale → `403 BRANCH_FORBIDDEN`; `GET /api/deliveries` lists branch-scoped and filters by `?status=`; `GET /api/deliveries/:id` returns the history; `PATCH /api/deliveries/:id/status` advances the status and rejects an illegal transition with `400 INVALID_TRANSITION`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `deliveryRoutes`. `POST` (`delivery.manage`) — load the sale; branch-scoped users must own its branch (`BRANCH_FORBIDDEN`); call `createDelivery`; map `DeliveryError` → `400`. `GET` (`delivery.view`) — filter `where: { sale: { branchId } }` for branch-scoped users, plus optional `status` and `scheduledDate` range from `from`/`to`. `GET /:id` — include `history` ordered by id, and `sale`. `PATCH /:id/status` (`delivery.manage`) — branch-scope check via the delivery's sale; call `changeDeliveryStatus`; map `DeliveryError` → `400`. Register in `app.ts`.
- [ ] **Step 4:** Run — PASS; run the full API suite and `npm run build --workspace apps/api`. Commit: `feat(api): add delivery routes`.

## Task 7: Web — delivery config API & settings view

**Files:** Create `apps/web/src/api/delivery.ts`, `apps/web/src/views/DeliverySettingsView.vue`; add i18n keys.

- [ ] **Step 1:** Add i18n keys (`delivery`, `deliveries`, `zone`, `channel`, `team`, `driver`, `fee`, `scheduledDate`, `recipient`, `address`, `deliverySettings`, `book`) to `th.ts`/`en.ts`.
- [ ] **Step 2:** Create `api/delivery.ts` — interfaces (`Zone`, `Channel`, `Team`, `Driver`, `Delivery`, `DeliveryStatusEntry`) and the `fetch*`/`create*`/`update*`/`bookDelivery`/`changeDeliveryStatus` functions.
- [ ] **Step 3:** Create `DeliverySettingsView.vue` — one screen with four sections (zones, channels, teams, drivers); each lists rows and, for `delivery.manage` users, has an inline create form.
- [ ] **Step 4:** Commit: `feat(web): add delivery config API and settings view`.

## Task 8: Web — delivery booking & list views

**Files:** Create `apps/web/src/views/DeliveryFormView.vue`, `apps/web/src/views/DeliveryListView.vue`.

- [ ] **Step 1:** `DeliveryFormView.vue` — pick a sale (recent sales `<select>`), a zone, a channel, an optional team/driver, a scheduled date, address and recipient fields; submit via `bookDelivery`, then route to the detail.
- [ ] **Step 2:** `DeliveryListView.vue` — the scheduling list: deliveries grouped/sorted by `scheduledDate` with a status filter; each row links to the detail.
- [ ] **Step 3:** Commit: `feat(web): add delivery booking and list views`.

## Task 9: Web — delivery detail view

**Files:** Create `apps/web/src/views/DeliveryDetailView.vue`.

- [ ] **Step 1:** `DeliveryDetailView.vue` — shows the sale, zone/channel/team/driver, address, recipient, fee, and the status history timeline. For `delivery.manage` users, the legal next statuses (from the state machine, mirrored client-side) appear as buttons that call `changeDeliveryStatus` and reload.
- [ ] **Step 2:** Commit: `feat(web): add delivery detail view with status timeline`.

## Task 10: Web — router & nav wiring + build

**Files:** Modify `apps/web/src/router/index.ts`, `apps/web/src/App.vue`.

- [ ] **Step 1:** Add routes: `/deliveries` (`delivery.view`), `/deliveries/new` (`delivery.manage`), `/deliveries/:id` (`delivery.view`), `/delivery-settings` (`delivery.view`). Lazy-import; place `/deliveries/new` before `/deliveries/:id`.
- [ ] **Step 2:** Add nav `RouterLink`s for deliveries and delivery settings, permission-gated.
- [ ] **Step 3:** Run `npm test --workspace apps/web` and `npm run build --workspace apps/web` (exit 0).
- [ ] **Step 4:** Manual end-to-end smoke check against a live API: create a zone/channel, ring up a sale, book a delivery, walk it through `SCHEDULED → IN_TRANSIT → DELIVERED`, and confirm the history.
- [ ] **Step 5:** Commit: `feat(web): wire delivery routes and navigation`.

---

## Self-Review Notes

- **Spec coverage (§5, §13):** `delivery_zones`/`delivery_channels`/`delivery_teams`/`drivers`/`deliveries`/`delivery_status_history` ✓ (Task 1); the in-house-team vs. courier distinction is the `DeliveryChannelType` ✓; the status state machine + per-delivery history ✓ (Tasks 3, 5); the scheduling "calendar" is the date-grouped delivery list ✓ (Task 8). Branch scoping flows through `Delivery → Sale → branchId`.
- **Delivery fee:** the zone fee is snapshotted onto the delivery for the record; wiring it into sale totals / collection is out of scope — Phase 5 sales are already closed when a delivery is booked, and a deposit/settle flow already exists for later money.
- **Out of Phase 7 scope:** the SSE `delivery.updated` push is Phase 8; route optimisation, driver mobile apps, and live tracking are explicitly YAGNI (spec §12). Delivery config is seeded with permissions only — real zones/teams are entered through the UI (no fake seed data, spec §11).
- **State machine:** `canTransition` is a pure, fully unit-tested function reused by the service (server-enforced) and mirrored read-only in the detail view (UX only).
- **Test isolation:** `resetAuthTables` gains the six delivery tables in FK-safe order; `fileParallelism: false` keeps the shared-DB suites serial.

## Next Phase

Phase 8 (Reports & Dashboard — Z-reports, the daily Email/LINE report, the dashboard, and the SSE real-time push) gets its own plan once Phase 7 is complete and reviewed.
