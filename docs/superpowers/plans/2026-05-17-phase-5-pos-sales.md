# Phase 5: POS & Sales — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Builds on Phases 1–4.

**Goal:** Add the point-of-sale checkout — a transactional sale that snapshots line items, extracts VAT from VAT-inclusive prices, issues a per-branch running document number, decrements branch stock, earns/redeems loyalty points, and produces an abbreviated or full tax invoice — plus the POS, sales-history, and printable-receipt UI.

**Architecture:** Checkout is a single `checkout()` service that runs entirely inside one `prisma.$transaction`. It validates the cart, prices each line from the live `Product.basePrice` (snapshotting price and name onto `SaleItem`), applies a role-capped percentage discount and optional point redemption, extracts the 7% VAT base from the VAT-inclusive total, allocates the next per-branch number from `number_sequences`, then writes the `Sale`, `SaleItem`s, `Payment`s, and `TaxInvoice`, decrements stock through the Phase 3 `applyStockMovement` (reason `SALE`), and — for a member — earns/redeems points through the Phase 4 `applyPointTransaction` and bumps `lifetimeSpend` (which makes membership tiers go live). Any failure — insufficient stock, insufficient points, payment mismatch — throws and rolls the whole thing back, including the consumed number, so numbering stays gapless. Branch-scoped roles can only sell at their own branch; warehouse branches cannot sell.

**Tech Stack:** Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, vue-router 4, Pinia 2, Vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§4.2 transaction, §5 data model, §7 VAT & tax invoice, §13 phase 5)

---

## Data Model

New Prisma models (`@@map` snake_case, consistent with Phases 1–4):

- **`NumberSequence`** — `id`, `branchId`, `kind` (String, e.g. `"sale"`), `next` (Int, default 1). `@@unique([branchId, kind])`. The next document number to issue for a branch.
- **`Sale`** — `id`, `number` (String — `"<branchCode>-000123"`), `branchId`, `customerId?`, `cashierId`, `status` (`SaleStatus`, default `COMPLETED`), `subtotal`, `discountAmount`, `pointsRedeemed`, `total`, `taxBase`, `vatAmount`, `pointsEarned`, `createdAt`. All money is Int baht, VAT-inclusive except `taxBase`/`vatAmount`.
- **`SaleItem`** — `id`, `saleId`, `productId`, `productName` (snapshot), `unitPrice` (snapshot, VAT-inclusive), `quantity`, `lineTotal`.
- **`Payment`** — `id`, `saleId`, `method` (`PaymentMethod`), `amount`.
- **`TaxInvoice`** — `id`, `saleId` (unique, 1:1), `type` (`TaxInvoiceType`), `customerTaxId?`, `customerTaxName?`, `customerTaxAddress?` (snapshot at issue; null for abbreviated), `createdAt`.
- **`AppSetting`** — `key` (unique `@id`), `value` (String). Key-value store; Phase 5 seeds company info, Phase 9 adds management.
- Enums — `SaleStatus { COMPLETED }` (`VOIDED` arrives with Phase 6 refunds); `PaymentMethod { CASH, TRANSFER, CARD }`; `TaxInvoiceType { ABBREVIATED, FULL }`.

Existing models gain a nullable sale link for ledger traceability (spec §5 — every stock change is recorded for audit):
- `StockMovement` — add `saleId Int?` + `sale Sale?` relation.
- `PointTransaction` — add `saleId Int?` + `sale Sale?` relation.
- Back-relations: `Branch.sales`, `Branch.numberSequences`, `Customer.sales`, `User.salesRung`.

---

## VAT & points-earning (pure module `apps/api/src/sales/money.ts`)

```typescript
export const VAT_RATE = 0.07;
export const POINTS_PER_BAHT = 1 / 100; // 1 point per 100 baht spent

/** Splits a VAT-inclusive gross amount into its tax base and VAT portion. */
export function extractVat(gross: number): { taxBase: number; vatAmount: number } {
  const taxBase = Math.round(gross / (1 + VAT_RATE));
  return { taxBase, vatAmount: gross - taxBase };
}

/** Loyalty points earned for an amount actually paid. */
export function calcPointsEarned(amountPaid: number): number {
  return Math.floor(amountPaid * POINTS_PER_BAHT);
}
```

---

## Permissions (added to the Phase 4 seed catalog)

| key | description (th) |
|-----|------------------|
| `sales.create` | ขายสินค้า (เปิดบิล) |
| `sales.view` | ดูประวัติการขาย |

Role grants (on top of Phase 4): **owner/admin** — all (via `ALL`); **manager** — `sales.create`, `sales.view`; **cashier** — `sales.create`, `sales.view`; **account** — `sales.view`.

App settings seeded by `runSeed` (idempotent upsert): `company.name`, `company.taxId`, `company.address`, `company.phone`.

---

## API surface

| Method & path | Permission | Notes |
|---------------|-----------|-------|
| `POST /api/sales` | `sales.create` | checkout; branch-scoped users restricted to own branch |
| `GET /api/sales` | `sales.view` | branch-scoped; recent sales |
| `GET /api/sales/:id` | `sales.view` | sale + items + payments + taxInvoice + customer |
| `GET /api/settings` | authenticated | company key-value map (for the receipt header) |

---

## Task 1: Prisma schema — sales models + migration

**Files:** Modify `apps/api/prisma/schema.prisma`.

- [ ] **Step 1:** Add the three enums and the six models in *Data Model*. Add `saleId Int?` + `sale Sale?` to `StockMovement` and `PointTransaction`. Add `sales`, `numberSequences` back-relations to `Branch`, `sales` to `Customer`, `salesRung Sale[]` to `User`.
- [ ] **Step 2:** Migrate: `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name sales && cd ../..` — ends with `Your database is now in sync`.
- [ ] **Step 3:** Commit: `feat(api): add sales, payment, tax-invoice models and migration`.

## Task 2: Seed — sales permissions & company settings

**Files:** Modify `apps/api/src/seed/catalog.ts`, `apps/api/src/seed/index.ts`, `apps/api/src/seed/index.test.ts`.

- [ ] **Step 1:** Append `sales.create`, `sales.view` to `PERMISSIONS`; add to `manager`/`cashier` (both) and `account` (`sales.view`) in `ROLES`.
- [ ] **Step 2:** Add an `APP_SETTINGS` constant to `catalog.ts` (`company.name`/`taxId`/`address`/`phone` with placeholder values) and, in `runSeed`, idempotently `upsert` each into `appSetting`.
- [ ] **Step 3:** Update `index.test.ts` — `cashier.permissions` length becomes `7`; add a test that `runSeed` creates the company `appSetting` rows.
- [ ] **Step 4:** Run `DATABASE_URL_TEST=... npm test --workspace apps/api` — PASS. Apply to dev DB via `npx prisma db seed`.
- [ ] **Step 5:** Commit: `feat(api): seed sales permissions and company settings`.

## Task 3: VAT & points-earning module — TDD

**Files:** Create `apps/api/src/sales/money.ts` + `money.test.ts`.

- [ ] **Step 1:** Write `money.test.ts` — `extractVat(107)` → `{ taxBase: 100, vatAmount: 7 }`; `extractVat(1070)` → `{ 1000, 70 }`; a non-round case (e.g. `1000`) where `taxBase + vatAmount` still equals the input; `calcPointsEarned(250)` → `2`, `calcPointsEarned(99)` → `0`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement `money.ts` as shown above. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit: `feat(api): add VAT extraction and points-earning helpers`.

## Task 4: Number-sequence service — TDD

**Files:** Create `apps/api/src/sales/numbering.ts` + `numbering.test.ts`.

- [ ] **Step 1:** Write `numbering.test.ts` against a real DB — `nextNumber(tx, branchId, "sale")` returns 1 then 2 on successive calls; sequences for two branches are independent.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `nextNumber(tx, branchId, kind)`: `upsert` the `(branchId, kind)` row (`create { next: 1 }`, `update {}`), then `update` with `data: { next: { increment: 1 } }`; the issued number is `updated.next - 1`. Also export `formatSaleNumber(branchCode, n)` → `` `${branchCode}-${String(n).padStart(6, "0")}` ``.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add per-branch document numbering service`.

## Task 5: Checkout service — TDD  *(core business logic)*

**Files:** Create `apps/api/src/sales/checkout.ts` + `checkout.test.ts`. Modify `apps/api/src/stock/service.ts` and `apps/api/src/membership/points.ts` to accept an optional `saleId` and write it onto the ledger row.

- [ ] **Step 1:** Write `checkout.test.ts` against a real DB. Build a fixture (branch with code, non-warehouse; a warehouse branch; products with stock seeded via `applyStockMovement`; optionally a customer). Cases:
  - happy path: two line items, cash payment equal to total → a `Sale` with `number` `"<code>-000001"`, snapshotted items, `subtotal`/`total`, `taxBase + vatAmount === total`, stock decremented, a `TaxInvoice` of type `ABBREVIATED`.
  - second checkout at the same branch → number `"...-000002"`; a different branch starts at `000001`.
  - insufficient stock → throws; **no** `Sale` row, stock unchanged, and the number is **not** consumed (next checkout is still `000001`).
  - discount within the role cap reduces `total`; a discount above the passed `maxDiscountPercent` → throws `CheckoutError` code `DISCOUNT_TOO_HIGH`.
  - payments not summing to `total` → throws `PAYMENT_MISMATCH`.
  - a warehouse branch → throws `WAREHOUSE_NO_SALE`; an empty cart → `EMPTY_CART`.
  - with a customer: `pointsEarned === calcPointsEarned(total)`, the customer's `pointsBalance` rises by that much, `lifetimeSpend` rises by `total`; redeeming points lowers the balance and the `total`, and redeeming more than the balance throws.
  - a full tax invoice: a customer carrying `taxId` produces a `TaxInvoice` of type `FULL` snapshotting the tax fields.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Add optional `saleId?: number` to `applyStockMovement` and `applyPointTransaction` args and include it in the created ledger row. Implement `checkout.ts`:
  ```typescript
  export class CheckoutError extends Error {
    constructor(public code: string, message: string) { super(message); }
  }

  interface CheckoutArgs {
    branchId: number;
    cashierId: number;
    customerId?: number;
    items: { productId: number; quantity: number }[];
    payments: { method: PaymentMethod; amount: number }[];
    discountPercent?: number;
    redeemPoints?: number;
    maxDiscountPercent: number | null; // from the cashier's role
  }
  ```
  Logic, all inside one `prisma.$transaction`:
  1. Reject an empty `items` array (`EMPTY_CART`).
  2. Load the branch; reject if missing or `isWarehouse` (`WAREHOUSE_NO_SALE`).
  3. `discountPercent` defaults to 0; reject `< 0`, `> 100`, or — when `maxDiscountPercent` is non-null — above it (`DISCOUNT_TOO_HIGH`).
  4. Load every product; build `SaleItem` rows snapshotting `productName`/`unitPrice`, `lineTotal = unitPrice * quantity`; `subtotal = Σ lineTotal`.
  5. `discountAmount = Math.round(subtotal * discountPercent / 100)`. `redeemPoints` defaults to 0; if `> 0` require `customerId`. `total = subtotal - discountAmount - redeemPoints`; reject `total < 0` (`NEGATIVE_TOTAL`).
  6. Reject if `Σ payments.amount !== total` (`PAYMENT_MISMATCH`).
  7. `{ taxBase, vatAmount } = extractVat(total)`; `pointsEarned = calcPointsEarned(total)`.
  8. `nextNumber(tx, branchId, "sale")` → `formatSaleNumber(branch.code, n)`.
  9. Create the `Sale`, then `SaleItem`s and `Payment`s.
  10. For each item, `applyStockMovement(tx, { …, delta: -quantity, reason: "SALE", saleId, userId: cashierId })`.
  11. Create the `TaxInvoice` — `FULL` + tax snapshot when the customer has a `taxId`, else `ABBREVIATED`.
  12. When `customerId`: `applyPointTransaction(tx, { …, delta: -redeemPoints, reason: "REDEEM", saleId })` if redeeming, `applyPointTransaction(tx, { …, delta: pointsEarned, reason: "EARN", saleId })` if earning, and `customer.update` `lifetimeSpend: { increment: total }`.
  13. Return the sale with `items`, `payments`, `taxInvoice`.
  `StockError`/`PointError` propagate out of the transaction (the route maps them).
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add transactional checkout service`.

## Task 6: Sales & settings routes — TDD

**Files:** Create `apps/api/src/routes/sales.ts` + `.test.ts`, `apps/api/src/routes/settings.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `sales.test.ts` — `POST /api/sales` with `sales.create` returns 201 with the sale; a branch-scoped cashier selling another branch → `403 BRANCH_FORBIDDEN`; insufficient stock → `400 INSUFFICIENT_STOCK`; a discount over the cashier's cap → `400 DISCOUNT_TOO_HIGH`; `GET /api/sales` lists (branch-scoped); `GET /api/sales/:id` returns items + payments + taxInvoice; `GET /api/settings` returns the seeded company keys.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `saleRoutes`: `POST /api/sales` (`sales.create`) — branch-scoped users must post their own `branchId` (`403 BRANCH_FORBIDDEN`); call `checkout({ …body, cashierId: user.id, maxDiscountPercent: user.discountMaxPercent })`; map `CheckoutError` → `400` with `err.code`, `StockError` → `400 INSUFFICIENT_STOCK`, `PointError` → `400 INSUFFICIENT_POINTS`. `GET /api/sales` + `/:id` (`sales.view`) apply `branchFilter`. Implement `settingsRoutes`: `GET /api/settings` (`app.authenticate` only) → `appSetting.findMany` reduced to a `{ key: value }` object. Register both in `app.ts`.
- [ ] **Step 4:** Run — PASS; run the **full** API suite and `npm run build --workspace apps/api`. Commit: `feat(api): add sales checkout, history, and settings routes`.

## Task 7: Web — sales API module & POS checkout view

**Files:** Create `apps/web/src/api/sales.ts`, `apps/web/src/views/PosView.vue`; add i18n keys.

- [ ] **Step 1:** Add i18n keys to `th.ts`/`en.ts`: `pos`, `sales`, `cart`, `subtotal`, `discount`, `total`, `vat`, `payment`, `checkout`, `receipt`, `redeemPoints`, `taxInvoice`, `change`.
- [ ] **Step 2:** Create `api/sales.ts` — `Sale`, `SaleItem`, `Payment`, `CheckoutInput` interfaces; `checkout(input)`, `fetchSales()`, `fetchSale(id)`, `fetchSettings()`.
- [ ] **Step 3:** Create `PosView.vue` — choose products into a cart with editable quantities; live `subtotal`/`discount`/`total` (computed); a discount-% input; optional customer lookup by phone (`fetchCustomers(q)`) showing the points balance + a redeem-points input; a payment method `<select>` and amount (defaulting to `total`); a checkout button that posts and, on success, routes to the receipt. Errors surfaced inline.
- [ ] **Step 4:** Commit: `feat(web): add sales API module and POS checkout view`.

## Task 8: Web — sales history view

**Files:** Create `apps/web/src/views/SalesListView.vue`.

- [ ] **Step 1:** `SalesListView.vue` — table of recent sales (number, date, total, item count) with each number linking to the receipt.
- [ ] **Step 2:** Commit: `feat(web): add sales history view`.

## Task 9: Web — printable receipt view

**Files:** Create `apps/web/src/views/ReceiptView.vue`.

- [ ] **Step 1:** `ReceiptView.vue` — loads the sale and the company settings; renders the company header, sale number/date/cashier, the item table, subtotal/discount/total, a VAT line (`taxBase` + `vatAmount`), the tax-invoice type (and the customer tax block when `FULL`), and a "Print" button calling `window.print()`. Include a scoped `@media print` block that hides the app nav and the print button.
- [ ] **Step 2:** Commit: `feat(web): add printable receipt view`.

## Task 10: Web — router & nav wiring + build

**Files:** Modify `apps/web/src/router/index.ts`, `apps/web/src/App.vue`.

- [ ] **Step 1:** Add routes: `/pos` (`sales.create`), `/sales` (`sales.view`), `/sales/:id` → `ReceiptView` (`sales.view`). Lazy-import. Make `/` redirect to `/pos` when reachable — keep the existing `/branches` redirect simple: leave `/` → `/branches` unchanged to avoid guard churn.
- [ ] **Step 2:** Add nav `RouterLink`s for POS and sales gated by permission in `App.vue`.
- [ ] **Step 3:** Run `npm test --workspace apps/web` and `npm run build --workspace apps/web` (exit 0).
- [ ] **Step 4:** Manual end-to-end smoke check against a live API: log in, ring up a sale with two products and a member, verify VAT split, stock decremented, points earned, the per-branch number, and the receipt renders.
- [ ] **Step 5:** Commit: `feat(web): wire POS, sales, and receipt routes`.

---

## Self-Review Notes

- **Spec coverage (§4.2, §5, §7, §13):** transactional checkout — the whole sale is one `prisma.$transaction`, rolling back on any failure ✓ (Task 5); `sales`/`sale_items`/`payments`/`tax_invoices`/`number_sequences` ✓ (Task 1); VAT extracted from VAT-inclusive prices and stored on the bill ✓ (Tasks 3, 5); abbreviated vs full tax invoice driven by customer tax data ✓ (Task 5); per-branch continuous numbering ✓ (Task 4 — and gapless because a rolled-back checkout un-consumes the number); company info in `app_settings` ✓ (Task 2); printing ✓ (Task 9). Role `discountMaxPercent` cap enforced server-side ✓ (Task 5/6 — the Phase 2 field finally bites). Membership tiers go live — checkout increments `lifetimeSpend` ✓ (Task 5).
- **Ledger linkage:** `SALE` stock movements and `EARN`/`REDEEM` point transactions carry the new `saleId`, so the Phase 3/4 ledgers become a full per-sale audit trail and Phase 6 refunds can find and reverse them.
- **Out of Phase 5 scope:** refunds / void (`SaleStatus.VOIDED`), quotations, and deposit/outstanding balances are Phase 6; the SSE `sale.completed` push is Phase 8; Z-reports are Phase 8. `app_settings` *management* UI is Phase 9 — Phase 5 only seeds and reads it.
- **Money:** all amounts are integer baht; `extractVat` rounds the base and assigns the remainder to VAT so `taxBase + vatAmount` always re-sums to the gross. Point redemption is 1 point = 1 baht.
- **Test isolation:** `resetAuthTables` gains the new tables (sales, sale_items, payments, tax_invoices, number_sequences, app_settings) in FK-safe order; `fileParallelism: false` keeps the shared-DB suites serial.

## Next Phase

Phase 6 (Receipts, Quotations, Outstanding — refunds/void, quotations, deposit balances) gets its own plan once Phase 5 is complete and reviewed.
