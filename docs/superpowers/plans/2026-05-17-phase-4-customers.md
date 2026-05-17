# Phase 4: Customers — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Builds on Phases 1–3.

**Goal:** Add the customer registry (with full-tax-invoice fields), a loyalty-points ledger with a maintained balance, and computed membership tiers, all RBAC-protected, plus the management UI.

**Architecture:** A `customers` table holds member records (identified by phone) including the tax fields a full tax invoice needs. Loyalty points follow the same ledger pattern as Phase 3 stock: every change goes through `applyPointTransaction`, which inside a transaction adjusts the customer's `pointsBalance` with an atomic conditional `updateMany` (`WHERE points_balance >= needed`) so a redemption can never overdraw, then appends a `point_transactions` row. Membership tier is **not stored** — it is computed from the customer's `lifetimeSpend` by a pure `getTier` function (spec §5). `lifetimeSpend` is maintained by the Phase 5 POS checkout; in Phase 4 it stays 0, so tier logic is proven by unit tests and wired into responses, ready to go live in Phase 5. Customers are not branch-scoped (a member shops at any branch).

**Tech Stack:** Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, vue-router 4, Pinia 2, Vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§5 data model, §7 tax invoice, §13 phase 4)

---

## Data Model

New Prisma models (`@@map` to snake_case, consistent with Phases 1–3):

- **`Customer`** — `id`, `name`, `phone` (unique), `email?`, `taxId?`, `taxName?`, `taxAddress?` (the full-tax-invoice fields, §7), `pointsBalance` (Int, default 0 — maintained), `lifetimeSpend` (Int, default 0 — maintained by Phase 5 checkout; drives tier), `createdAt`.
- **`PointTransaction`** — append-only ledger: `id`, `customerId`, `delta` (Int, signed), `reason` (enum), `note?`, `userId?`, `createdAt`.
- **`PointTransactionReason`** enum — `EARN`, `REDEEM`, `ADJUST`. Phase 4 uses `ADJUST` (manual staff corrections / promotional grants); `EARN`/`REDEEM` are declared for the Phase 5 checkout.

Back-relation added to `User`: `pointTransactions PointTransaction[]`.

---

## Membership tiers (computed, not stored)

A pure module `apps/api/src/membership/tiers.ts`:

```typescript
export interface TierDef { key: string; name: string; minSpend: number; }

export const TIERS: TierDef[] = [
  { key: "bronze",   name: "บรอนซ์",    minSpend: 0 },
  { key: "silver",   name: "ซิลเวอร์",   minSpend: 30000 },
  { key: "gold",     name: "โกลด์",      minSpend: 100000 },
  { key: "platinum", name: "แพลทินัม",   minSpend: 300000 },
];

/** Highest tier whose minSpend the lifetime spend reaches. TIERS is ascending. */
export function getTier(lifetimeSpend: number): TierDef {
  let result = TIERS[0];
  for (const t of TIERS) if (lifetimeSpend >= t.minSpend) result = t;
  return result;
}
```

---

## Permissions (added to the Phase 3 seed catalog)

| key | description (th) |
|-----|------------------|
| `customers.view` | ดูข้อมูลลูกค้า |
| `customers.manage` | เพิ่ม/แก้ไขลูกค้าและปรับแต้มสะสม |

Role grants (on top of Phase 3): **owner/admin** — all (via `ALL`); **manager** — `customers.view`, `customers.manage`; **cashier** — `customers.view`, `customers.manage` (cashiers register members at the counter); **account** — `customers.view`.

---

## API surface

| Method & path | Permission | Notes |
|---------------|-----------|-------|
| `GET /api/customers` | `customers.view` | optional `?q=` (name or phone contains); each row carries computed `tier` |
| `GET /api/customers/:id` | `customers.view` | customer + `tier` + recent `pointTransactions` |
| `POST /api/customers` | `customers.manage` | duplicate phone → `409 DUPLICATE` |
| `PATCH /api/customers/:id` | `customers.manage` | name, email, tax fields |
| `POST /api/customers/:id/points` | `customers.manage` | `{ delta, note? }` — reason `ADJUST`; overdraw → `400 INSUFFICIENT_POINTS` |

---

## Task 1: Prisma schema — Customer & PointTransaction + migration

**Files:** Modify `apps/api/prisma/schema.prisma`.

- [ ] **Step 1:** Add the `PointTransactionReason` enum, the `Customer` and `PointTransaction` models, and a `pointTransactions PointTransaction[]` back-relation on `User`.
- [ ] **Step 2:** Create the migration:
  `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name customers && cd ../..`
  Expected: a new `migrations/<ts>_customers/` folder; ends with `Your database is now in sync`.
- [ ] **Step 3:** Commit: `feat(api): add customer and point-transaction models and migration`.

## Task 2: Seed — customer permissions & role grants

**Files:** Modify `apps/api/src/seed/catalog.ts`, `apps/api/src/seed/index.test.ts`.

- [ ] **Step 1:** Append `customers.view` and `customers.manage` to `PERMISSIONS`. Add them to `manager`/`cashier` (both keys) and `account` (`customers.view`) permission arrays in `ROLES`.
- [ ] **Step 2:** Update `index.test.ts` — the `cashier.permissions` length assertion becomes `5` (was 3: + `customers.view`, `customers.manage`).
- [ ] **Step 3:** Run `DATABASE_URL_TEST=... npm test --workspace apps/api` — PASS. Apply to dev DB via `npx prisma db seed`.
- [ ] **Step 4:** Commit: `feat(api): seed customer permissions`.

## Task 3: Membership tiers module — TDD

**Files:** Create `apps/api/src/membership/tiers.ts` + `tiers.test.ts`.

- [ ] **Step 1:** Write `tiers.test.ts` — pure unit tests (no DB): `getTier(0)` → bronze; just below a threshold stays on the lower tier; exactly at a threshold promotes; a very large spend → platinum.
- [ ] **Step 2:** Run — FAIL (no module).
- [ ] **Step 3:** Implement `tiers.ts` as shown in *Membership tiers* above.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add membership tier computation`.

## Task 4: Customers CRUD routes — TDD

**Files:** Create `apps/api/src/routes/customers.ts` + `.test.ts`; modify `apps/api/src/app.ts`, `apps/api/src/test-helpers/auth.ts`.

- [ ] **Step 1:** Extend `resetAuthTables` — clear `pointTransaction` then `customer` (before the `user` delete, FK-safe).
- [ ] **Step 2:** Write `customers.test.ts` — list requires `customers.view`; `?q=` filters by name/phone; create (201, `customers.manage`); viewer-forbidden on create; duplicate phone → 409; patch updates tax fields; each list row and the detail carry a `tier` object.
- [ ] **Step 3:** Run — FAIL (404).
- [ ] **Step 4:** Implement `customerRoutes`: `GET /api/customers` (optional `q` querystring → `where { OR: [name contains, phone contains] }`, ordered by id; map each row to add `tier: getTier(row.lifetimeSpend)`); `GET /api/customers/:id` (include recent `pointTransactions`, `orderBy id desc, take 50`; add `tier`); `POST` (schema: `name`, `phone` required, `email?`/tax fields optional); `PATCH /:id`. Wrap `P2002` → `409 DUPLICATE`. Register in `app.ts`.
- [ ] **Step 5:** Run — PASS. Commit: `feat(api): add customers CRUD routes with tier computation`.

## Task 5: Points service — TDD

**Files:** Create `apps/api/src/membership/points.ts` + `points.test.ts`.

- [ ] **Step 1:** Write `points.test.ts` against a real DB: a positive `ADJUST` raises `pointsBalance` and writes one ledger row; a negative `ADJUST` within balance lowers it; a negative delta beyond balance throws `PointError` and writes nothing; an unknown customer id throws `PointError`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement:
  ```typescript
  export class PointError extends Error {}

  export async function applyPointTransaction(
    tx: Prisma.TransactionClient,
    args: { customerId: number; delta: number; reason: PointTransactionReason;
            note?: string; userId?: number },
  ): Promise<number> {
    const updated = await tx.customer.updateMany({
      where: { id: args.customerId, pointsBalance: { gte: -args.delta } },
      data: { pointsBalance: { increment: args.delta } },
    });
    if (updated.count === 0) {
      const exists = await tx.customer.findUnique({ where: { id: args.customerId } });
      throw new PointError(exists ? "แต้มสะสมไม่พอ" : "ไม่พบลูกค้า");
    }
    await tx.pointTransaction.create({ data: { ...args } });
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: args.customerId } });
    return customer.pointsBalance;
  }
  ```
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add loyalty-points transaction service`.

## Task 6: Point-adjust route — TDD

**Files:** Modify `apps/api/src/routes/customers.ts`, `apps/api/src/routes/customers.test.ts`.

- [ ] **Step 1:** Add test cases — `POST /api/customers/:id/points` with `customers.manage` raises the balance and the detail shows the ledger entry; an overdrawing negative delta → `400 INSUFFICIENT_POINTS`; a viewer (only `customers.view`) → `403`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Add the route: `preHandler` `customers.manage`; schema `{ delta (integer, non-zero), note? }`; `prisma.$transaction(tx => applyPointTransaction(tx, { customerId, delta, reason: "ADJUST", note, userId }))`; map `PointError` → `400 INSUFFICIENT_POINTS`.
- [ ] **Step 4:** Run — PASS; run the **full** API suite and `npm run build --workspace apps/api`. Commit: `feat(api): add manual loyalty-point adjustment route`.

## Task 7: Web — customer API module & list view

**Files:** Create `apps/web/src/api/customers.ts`, `apps/web/src/views/CustomerListView.vue`; add i18n keys.

- [ ] **Step 1:** Add i18n keys to `th.ts`/`en.ts`: `customers`, `customer`, `phone`, `email`, `points`, `tier`, `taxId`, `taxName`, `taxAddress`, `search`.
- [ ] **Step 2:** Create `api/customers.ts` — `Customer`, `Tier`, `PointTransaction` interfaces; `fetchCustomers(q?)`, `fetchCustomer(id)`, `createCustomer`, `updateCustomer`, `adjustPoints(id, delta, note?)`.
- [ ] **Step 3:** Create `CustomerListView.vue` — search box (`q`), table (name, phone, tier, points), `+` link gated on `customers.manage`.
- [ ] **Step 4:** Commit: `feat(web): add customer API module and list view`.

## Task 8: Web — customer form view

**Files:** Create `apps/web/src/views/CustomerFormView.vue`.

- [ ] **Step 1:** Create/edit form — name, phone (disabled when editing), email, tax id/name/address; reuses the Phase 2/3 `editingId` route pattern; inline error.
- [ ] **Step 2:** Commit: `feat(web): add customer form view`.

## Task 9: Web — customer detail view

**Files:** Create `apps/web/src/views/CustomerDetailView.vue`.

- [ ] **Step 1:** Detail view — shows tier, points balance, contact + tax fields, and the point-transaction history. For `customers.manage` users, an adjust-points form (`delta`, `note`) calling `adjustPoints`, then reload. Errors surfaced inline.
- [ ] **Step 2:** Commit: `feat(web): add customer detail view with point adjustment`.

## Task 10: Web — router & nav wiring + build

**Files:** Modify `apps/web/src/router/index.ts`, `apps/web/src/App.vue`.

- [ ] **Step 1:** Add routes: `/customers` (`customers.view`), `/customers/new` + `/customers/:id/edit` (`customers.manage`), `/customers/:id` (`customers.view`). Lazy-import. Order `/customers/new` before `/customers/:id` so it is not captured by the param route.
- [ ] **Step 2:** Add a nav `RouterLink` to `/customers` in `App.vue` gated on `customers.view`.
- [ ] **Step 3:** Run `npm test --workspace apps/web` and `npm run build --workspace apps/web` (exit 0).
- [ ] **Step 4:** Manual end-to-end smoke check against a live API: log in, create a customer, adjust points, verify the balance and tier.
- [ ] **Step 5:** Commit: `feat(web): wire customer routes and navigation`.

---

## Self-Review Notes

- **Spec coverage (§5, §7, §13):** `customers` with tax fields ✓ (Task 1); `point_transactions` append-only ledger ✓ (Tasks 1, 5); membership tier *computed, not stored* ✓ (Task 3 `getTier`, applied in Task 4); loyalty points with a maintained balance ✓ (Task 5). Customers are deliberately not branch-scoped — a member is not tied to one branch.
- **`lifetimeSpend` / tier in Phase 4:** spend accrues at POS checkout (Phase 5), so in Phase 4 `lifetimeSpend` stays 0 and every customer computes to `bronze`. `getTier` is fully unit-tested across all four tiers and already wired into API responses, so Phase 5 only has to increment `lifetimeSpend` for tiers to go live. It is intentionally **not** settable via the API — no fake data (spec §11).
- **Concurrency:** the atomic `updateMany ... WHERE points_balance >= needed` guard mirrors the Phase 3 stock service — a redemption cannot overdraw under Read Committed.
- **Out of Phase 4 scope:** `EARN`/`REDEEM` point flows happen at checkout (Phase 5 — points earned per spend, redeemed as discount); the enum values and nullable `userId` column are in place so Phase 5 needs no migration. `calcPointsEarned` (earn rate) belongs with the Phase 5 checkout.
- **Test isolation:** `resetAuthTables` gains `pointTransaction`/`customer` deletes in FK-safe order; `fileParallelism: false` keeps the shared-DB suites serial.

## Next Phase

Phase 5 (POS & Sales — checkout transaction, VAT, receipts/tax invoices, printing) gets its own plan once Phase 4 is complete and reviewed.
