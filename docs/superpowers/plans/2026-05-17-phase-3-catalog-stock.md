# Phase 3: Catalog & Stock — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Builds on the Phase 1 foundation and Phase 2 auth/RBAC.

**Goal:** Add the product catalog (categories, products, sofa materials/colors) and the per-branch stock system (stock levels, an append-only movement ledger, manual adjustments, and inter-branch transfers), all RBAC-protected and branch-scoped, plus the management UI.

**Architecture:** Every stock change goes through a single `applyStockMovement` service that, inside a transaction, upserts the `stock_levels` row and appends a `stock_movements` ledger entry. Quantity never goes negative — decrements use an atomic conditional `updateMany` (`WHERE quantity >= needed`) so concurrent movements cannot oversell. A transfer is one `transfers` row plus two linked movements (`TRANSFER_OUT` at source, `TRANSFER_IN` at destination) created in one transaction; if the source lacks stock the whole transfer rolls back. Branch-scoped roles (manager, cashier) see and adjust only their own branch's stock, enforced server-side via the Phase 2 `branchFilter` helper. The Vue app gains catalog and stock management screens.

**Tech Stack:** Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, vue-router 4, Pinia 2, Vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§5 data model, §13 phase 3)

---

## Data Model

New Prisma models (all `@@map` to snake_case tables, consistent with Phases 1–2):

- **`Category`** — `id`, `name` (unique), `createdAt`.
- **`Product`** — `id`, `sku` (unique), `name`, `categoryId`, `basePrice` (Int, baht, VAT-inclusive), `isSofa` (Boolean), `isActive` (Boolean), `createdAt`.
- **`SofaMaterial`** — `id`, `key` (unique), `name`, `priceMultiplierPct` (Int — 100 = ×1.00, 160 = ×1.60). Avoids `Decimal` JSON/serialization friction.
- **`SofaColor`** — `id`, `materialId`, `name`. Per-material palette; `onDelete: Cascade`.
- **`StockLevel`** — composite id `(productId, branchId)`, `quantity` (Int, default 0). The current on-hand count.
- **`StockMovement`** — append-only ledger: `id`, `productId`, `branchId`, `delta` (Int, signed), `reason` (enum), `note?`, `userId?`, `transferId?`, `createdAt`.
- **`Transfer`** — `id`, `productId`, `fromBranchId`, `toBranchId`, `quantity`, `note?`, `userId?`, `createdAt`. Immediate (no multi-step workflow in v1).
- **`StockMovementReason`** enum — `ADJUST`, `TRANSFER_IN`, `TRANSFER_OUT`, `IMPORT`, `SALE`. Phase 3 uses the first three; `IMPORT`/`SALE` are declared for Phases 9/5.

Back-relations added to existing models: `Branch` gains `stockLevels`, `stockMovements`, `transfersFrom`/`transfersTo`; `User` gains `stockMovements`, `transfers`.

---

## Permissions (added to the Phase 2 seed catalog)

| key | description (th) |
|-----|------------------|
| `catalog.view` | ดูสินค้าและหมวดหมู่ |
| `catalog.manage` | เพิ่ม/แก้ไขสินค้าและหมวดหมู่ |
| `stock.view` | ดูสต็อกสินค้า |
| `stock.adjust` | ปรับสต็อกและโอนสินค้าระหว่างสาขา |

Role assignments (added on top of Phase 2):
- **owner, admin** — all four (they already get `ALL`).
- **manager** — `catalog.view`, `stock.view`, `stock.adjust`.
- **cashier** — `catalog.view`, `stock.view`.
- **account** — `catalog.view`, `stock.view`.

---

## API surface

| Method & path | Permission | Notes |
|---------------|-----------|-------|
| `GET /api/categories` | `catalog.view` | |
| `POST /api/categories` | `catalog.manage` | |
| `PATCH /api/categories/:id` | `catalog.manage` | |
| `GET /api/products` | `catalog.view` | optional `?categoryId=` filter |
| `POST /api/products` | `catalog.manage` | |
| `PATCH /api/products/:id` | `catalog.manage` | |
| `GET /api/sofa-materials` | `catalog.view` | materials with nested colors |
| `GET /api/stock` | `stock.view` | branch-scoped; optional `?branchId=` for unscoped roles |
| `POST /api/stock/adjust` | `stock.adjust` | `{ productId, branchId, delta, note? }` |
| `GET /api/stock/movements` | `stock.view` | branch-scoped; recent ledger entries |
| `GET /api/transfers` | `stock.view` | branch-scoped (matches from- or to-branch) |
| `POST /api/transfers` | `stock.adjust` | `{ productId, fromBranchId, toBranchId, quantity, note? }` |

Branch-scoped enforcement: for `isBranchScoped` users, list endpoints filter to their `branchId`; `stock/adjust` and `transfers` reject a `branchId`/`fromBranchId` that is not their own with `403 BRANCH_FORBIDDEN`.

---

## Task 1: Prisma schema — catalog & stock models + migration

**Files:** Modify `apps/api/prisma/schema.prisma`.

- [ ] **Step 1:** Add the `StockMovementReason` enum and the seven models listed in *Data Model*. Add back-relation fields to `Branch` and `User`. Use named relations (`@relation("TransferFrom")` / `@relation("TransferTo")`) on the two `Transfer`→`Branch` links.
- [ ] **Step 2:** Create the migration:
  `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name catalog_stock && cd ../..`
  Expected: a new `migrations/<ts>_catalog_stock/` folder; ends with `Your database is now in sync`.
- [ ] **Step 3:** Commit: `feat(api): add catalog and stock models and migration`.

## Task 2: Seed — catalog/stock permissions, role grants, sofa materials

**Files:** Modify `apps/api/src/seed/catalog.ts`, `apps/api/src/seed/index.ts`, `apps/api/src/seed/index.test.ts`.

- [ ] **Step 1:** Append the four permissions to `PERMISSIONS`. Add the new keys to `manager`/`cashier`/`account` permission arrays in `ROLES` (`owner`/`admin` use `ALL`, so they update automatically).
- [ ] **Step 2:** Add a `SOFA_MATERIALS` constant to `catalog.ts` — four grades: `economy` (100), `standard` (130), `premium` (165), `luxury` (210), each with a small color list.
- [ ] **Step 3:** In `runSeed`, after roles, upsert sofa materials by `key` and their colors (delete + recreate colors per material for idempotency).
- [ ] **Step 4:** Update `index.test.ts` — assert `permission.count()` equals the new `PERMISSIONS.length`, and add a test that `runSeed` creates the four sofa materials with colors and is idempotent on a second run.
- [ ] **Step 5:** Run `DATABASE_URL_TEST=... npm test --workspace apps/api` — PASS. Apply to dev DB via `npx prisma db seed`.
- [ ] **Step 6:** Commit: `feat(api): seed catalog/stock permissions and sofa materials`.

## Task 3: Categories routes — TDD

**Files:** Create `apps/api/src/routes/categories.ts` + `.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `categories.test.ts` — `GET` requires `catalog.view`; `POST`/`PATCH` require `catalog.manage`; a viewer gets 403 on `POST`; create returns 201; duplicate name → 409. Use the Phase 2 `createTestUser`/`sessionCookie`/`resetAuthTables` helpers. (Note: `resetAuthTables` must be extended in Step 4.)
- [ ] **Step 2:** Run tests — FAIL (route 404).
- [ ] **Step 3:** Implement `categoryRoutes`: `GET` (ordered by name), `POST` (JSON-schema `name`), `PATCH /:id`. Wrap Prisma unique-violation (`P2002`) into `409 DUPLICATE`.
- [ ] **Step 4:** Extend `resetAuthTables` in `test-helpers/auth.ts` to also clear the new tables (`stockMovement`, `transfer`, `stockLevel`, `sofaColor`, `sofaMaterial`, `product`, `category`) **before** the existing deletes — FK-safe order. Register `categoryRoutes` in `app.ts`.
- [ ] **Step 5:** Run tests — PASS. Commit: `feat(api): add categories routes`.

## Task 4: Products & sofa-materials routes — TDD

**Files:** Create `apps/api/src/routes/products.ts` + `.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `products.test.ts` — list (with `?categoryId` filter), create (201, `catalog.manage`), viewer-forbidden, patch, and `GET /api/sofa-materials` returns the four seeded materials with nested colors.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `productRoutes`: `GET /api/products` (optional `categoryId` querystring filter, ordered by id, includes category name), `POST` (schema: `sku`, `name`, `categoryId`, `basePrice`, `isSofa?`), `PATCH /:id`, `GET /api/sofa-materials` (`include: { colors: true }`). `P2002` → `409 DUPLICATE`. Register in `app.ts`.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add products and sofa-materials routes`.

## Task 5: Stock service — TDD  *(core business logic)*

**Files:** Create `apps/api/src/stock/service.ts` + `service.test.ts`.

- [ ] **Step 1:** Write `service.test.ts` against a real DB. Cases:
  - `applyStockMovement` with positive delta creates a level at that quantity and one movement row.
  - second movement accumulates the level quantity.
  - negative delta beyond on-hand throws `StockError` and leaves the level unchanged (no movement row written).
  - `transferStock` moves quantity: source decreases, destination increases, two movements + one transfer row, all linked by `transferId`.
  - `transferStock` from a branch with insufficient stock throws and writes **nothing** (transfer row rolled back).
  - `transferStock` with `fromBranchId === toBranchId` or `quantity <= 0` throws `StockError`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement:
  ```typescript
  export class StockError extends Error {}

  export async function applyStockMovement(
    tx: Prisma.TransactionClient,
    args: { productId: number; branchId: number; delta: number;
            reason: StockMovementReason; note?: string; userId?: number; transferId?: number },
  ): Promise<number> {
    await tx.stockLevel.upsert({
      where: { productId_branchId: { productId: args.productId, branchId: args.branchId } },
      update: {},
      create: { productId: args.productId, branchId: args.branchId, quantity: 0 },
    });
    // atomic guard: the WHERE re-checks the locked row, so concurrent
    // decrements cannot drive quantity below zero.
    const res = await tx.stockLevel.updateMany({
      where: { productId: args.productId, branchId: args.branchId, quantity: { gte: -args.delta } },
      data: { quantity: { increment: args.delta } },
    });
    if (res.count === 0) throw new StockError("สต็อกไม่พอสำหรับการเคลื่อนไหวนี้");
    await tx.stockMovement.create({ data: { ...args } });
    const level = await tx.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId: args.productId, branchId: args.branchId } },
    });
    return level.quantity;
  }
  ```
  `transferStock` validates `quantity > 0` and `fromBranchId !== toBranchId`, then in one `prisma.$transaction` creates the `Transfer` row and calls `applyStockMovement` twice (`-qty TRANSFER_OUT`, `+qty TRANSFER_IN`, both carrying `transferId`).
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add stock movement and transfer service`.

## Task 6: Stock routes — TDD

**Files:** Create `apps/api/src/routes/stock.ts` + `.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `stock.test.ts` — `GET /api/stock` lists levels (branch-scoped: a manager sees only their branch); `POST /api/stock/adjust` with `stock.adjust` changes the level and records a movement; insufficient negative adjust → `400`; a branch-scoped user adjusting another branch → `403`; `GET /api/stock/movements` returns recent entries (branch-scoped).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `stockRoutes`. `GET /api/stock` and `/movements` apply `branchFilter(request.user!)`; for unscoped users an optional `?branchId=` narrows results. `POST /api/stock/adjust`: if the user is branch-scoped and `body.branchId !== user.branchId` → `403 BRANCH_FORBIDDEN`; else `prisma.$transaction(tx => applyStockMovement(tx, { ...body, reason: "ADJUST", userId }))`; map `StockError` → `400 INSUFFICIENT_STOCK`. Register in `app.ts`.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add stock view, adjust, and movement routes`.

## Task 7: Transfer routes — TDD

**Files:** Create `apps/api/src/routes/transfers.ts` + `.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `transfers.test.ts` — `POST /api/transfers` with `stock.adjust` moves stock and returns 201; insufficient source stock → `400`; branch-scoped user transferring out of a branch other than their own → `403`; `GET /api/transfers` lists transfers (branch-scoped: matches from- **or** to-branch).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `transferRoutes`. `POST`: branch-scoped users must have `fromBranchId === user.branchId` (else `403`); call `transferStock`; map `StockError` → `400 INSUFFICIENT_STOCK`. `GET`: branch-scoped users filter with `OR: [{ fromBranchId }, { toBranchId }]`. Register in `app.ts`.
- [ ] **Step 4:** Run — PASS; run the **full** API suite and `npm run build --workspace apps/api`. Commit: `feat(api): add inter-branch transfer routes`.

## Task 8: Web — catalog API modules & category views

**Files:** Create `apps/web/src/api/categories.ts`, `apps/web/src/api/products.ts`, `apps/web/src/api/stock.ts`, `apps/web/src/views/CategoryListView.vue`; add i18n keys.

- [ ] **Step 1:** Add i18n keys to `th.ts`/`en.ts`: `categories`, `products`, `stock`, `transfers`, `quantity`, `adjust`, `transfer`, `price`, `category`, `sku`, `add`.
- [ ] **Step 2:** Create the three typed API modules (interfaces + `fetch*`/`create*`/`update*` using `apiGet`/`apiSend`).
- [ ] **Step 3:** Create `CategoryListView.vue` — lists categories, inline create form (gated on `catalog.manage` via `useAuthStore().hasPermission`), loading/error state.
- [ ] **Step 4:** Commit: `feat(web): add catalog API modules and category view`.

## Task 9: Web — product views

**Files:** Create `apps/web/src/views/ProductListView.vue`, `apps/web/src/views/ProductFormView.vue`.

- [ ] **Step 1:** `ProductListView.vue` — table of products (sku, name, category, price, sofa flag), `+` link gated on `catalog.manage`.
- [ ] **Step 2:** `ProductFormView.vue` — create/edit form; category `<select>` from `fetchCategories`; `isSofa` checkbox; reuses the Phase 2 form pattern (`editingId` computed from route).
- [ ] **Step 3:** Commit: `feat(web): add product list and form views`.

## Task 10: Web — stock view & adjust

**Files:** Create `apps/web/src/views/StockView.vue`.

- [ ] **Step 1:** `StockView.vue` — table of stock levels (product, branch, quantity). For users with `stock.adjust`: an inline adjust form (`product`, `branch`, signed `delta`, `note`) that calls `POST /api/stock/adjust` and reloads. Show API errors as a message.
- [ ] **Step 2:** Commit: `feat(web): add stock level view with adjustment`.

## Task 11: Web — transfer view

**Files:** Create `apps/web/src/views/TransferView.vue`.

- [ ] **Step 1:** `TransferView.vue` — recent transfers list + a create form (`product`, `from`/`to` branch `<select>`, `quantity`, `note`), gated on `stock.adjust`. Errors surfaced inline.
- [ ] **Step 2:** Commit: `feat(web): add inter-branch transfer view`.

## Task 12: Web — router & nav wiring + build

**Files:** Modify `apps/web/src/router/index.ts`, `apps/web/src/App.vue`.

- [ ] **Step 1:** Add routes: `/categories` (`catalog.view`), `/products` + `/products/new` + `/products/:id/edit` (`catalog.view`/`catalog.manage`), `/stock` (`stock.view`), `/transfers` (`stock.view`). Lazy-import the views.
- [ ] **Step 2:** Add nav `RouterLink`s in `App.vue` gated by `hasPermission`.
- [ ] **Step 3:** Run `npm test --workspace apps/web` (existing tests still pass) and `npm run build --workspace apps/web` (exit 0 — all lazy views now exist).
- [ ] **Step 4:** Manual end-to-end smoke check against a live API: seed, log in, create a category and product, adjust stock, transfer between branches.
- [ ] **Step 5:** Commit: `feat(web): wire catalog and stock routes and navigation`.

---

## Self-Review Notes

- **Spec coverage (§5, §13):** `categories`/`products`/`sofa_materials`/`sofa_colors` ✓ (Tasks 1–4); `stock_levels` + `stock_movements` append-only ledger ✓ (Task 1, 5); `transfers` ✓ (Tasks 1, 5, 7); per-branch stock with branch-scoped enforcement ✓ (Tasks 6, 7 via Phase 2 `branchFilter`); adjust/transfer ✓ (Tasks 6, 7). `product_variants` (size/color/material variant rows) is intentionally deferred — the Phase 13 summary scopes Phase 3 to "สินค้า/หมวด/วัสดุโซฟา, สต็อกรายสาขา, โอน/ปรับสต็อก"; variant selection belongs to the Phase 5 POS sofa builder.
- **Concurrency:** the atomic `updateMany ... WHERE quantity >= needed` guard prevents overselling under Read Committed without needing Serializable isolation; transfer atomicity comes from the surrounding `$transaction`.
- **Money:** `basePrice` is an integer (baht, VAT-inclusive per spec §7); `priceMultiplierPct` is an integer percentage — both avoid `Decimal` JSON friction. VAT extraction is a Phase 5 concern.
- **Out of Phase 3 scope:** `number_sequences`, `sales`, Excel import (`IMPORT` reason), and the SSE `stock.changed` push are later phases; the enum value and nullable `transferId`/`userId` columns are in place so later phases need no migration churn.
- **Test isolation:** `resetAuthTables` is extended to truncate the new tables in FK-safe order so the Phase 2 suites keep passing alongside the new ones; `fileParallelism: false` (set in Phase 2) keeps shared-DB tests serial.

## Next Phase

Phase 4 (Customers — customers, point transactions, membership tiers) gets its own plan once Phase 3 is complete and reviewed.
