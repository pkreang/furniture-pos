# Phase 6: Receipts, Quotations, Outstanding — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Builds on Phases 1–5.

**Goal:** Add three sale-lifecycle features on top of the Phase 5 checkout — voiding a sale (full refund: stock, points, and spend reversed), deposit / outstanding balances (a sale may be partly paid now and settled later), and quotations (a price quote that can be converted into a sale) — plus the UI for each.

**Architecture:** *Voiding* runs in one transaction: it returns every sold unit to stock (`REFUND` movements), gives back redeemed points and claws back earned points (clamped so the balance never goes negative), decrements the customer's `lifetimeSpend`, and flips the sale to `VOIDED`. *Deposits* relax the checkout payment rule — payments may now sum to **at most** the total; the unpaid remainder is stored on `Sale.outstanding` and later reduced by a settle endpoint that records additional `Payment`s. *Quotations* snapshot priced line items like a sale but touch no stock; converting one runs the Phase 5 checkout (refactored to expose an in-transaction `checkoutInTx`) and marks the quotation `CONVERTED` — atomically, in a single transaction. Branch-scoped roles act only on their own branch throughout.

**Tech Stack:** Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, vue-router 4, Pinia 2, Vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§5 data model, §13 phase 6)

---

## Data Model

Changes to existing models:

- **`Sale`** — add `outstanding` (Int, default 0 — unpaid remainder), `voidReason` (String?), `voidedById` (Int?), `voidedAt` (DateTime?). The `cashier`/`voidedBy` links both point at `User`, so they take named relations (`"SaleCashier"`, `"SaleVoidedBy"`).
- **`SaleStatus`** enum — add `VOIDED`.
- **`StockMovementReason`** enum — add `REFUND` (stock returned by a void).
- **`PointTransactionReason`** enum — add `REFUND` (points reversed by a void).
- Back-relations: `User.salesVoided`, `Branch.quotations`, `Customer.quotations`, `User.quotationsCreated`, `Sale.fromQuotation`.

New models:

- **`Quotation`** — `id`, `number` (String unique, `"<code>-Q000001"`), `branchId`, `customerId?`, `createdById`, `status` (`QuotationStatus`, default `OPEN`), `subtotal` (Int), `note?`, `convertedSaleId` (Int?, unique — the sale it became), `createdAt`.
- **`QuotationItem`** — `id`, `quotationId`, `productId`, `productName` (snapshot), `unitPrice` (snapshot), `quantity`, `lineTotal`.
- **`QuotationStatus`** enum — `OPEN`, `CONVERTED`.

---

## Permissions (added to the Phase 5 seed catalog)

| key | description (th) | granted to |
|-----|------------------|-----------|
| `sales.void` | ยกเลิกบิลและคืนเงิน | owner, admin, manager |
| `quotations.view` | ดูใบเสนอราคา | owner, admin, manager, cashier, account |
| `quotations.manage` | สร้างและแปลงใบเสนอราคา | owner, admin, manager, cashier |

Settling a deposit reuses `sales.create` (the same staff who ring sales take later payments).

---

## API surface (additions)

| Method & path | Permission | Notes |
|---------------|-----------|-------|
| `POST /api/sales/:id/void` | `sales.void` | full reversal; body `{ reason? }` |
| `POST /api/sales/:id/settle` | `sales.create` | body `{ method, amount }`; pays down `outstanding` |
| `GET /api/sales/outstanding` | `sales.view` | `COMPLETED` sales with `outstanding > 0`, branch-scoped |
| `POST /api/quotations` | `quotations.manage` | snapshots line prices |
| `GET /api/quotations` | `quotations.view` | branch-scoped |
| `GET /api/quotations/:id` | `quotations.view` | with items |
| `POST /api/quotations/:id/convert` | `quotations.manage` | body `{ payments, discountPercent?, redeemPoints? }` |

The checkout payment rule changes (Task 3): payments may sum to **≤ total** (a deposit); `≤ 0` → `NO_PAYMENT`, `> total` → `OVERPAYMENT`.

---

## Task 1: Prisma schema — void fields, quotations + migration

**Files:** Modify `apps/api/prisma/schema.prisma`.

- [ ] **Step 1:** Add `VOIDED` to `SaleStatus`, `REFUND` to `StockMovementReason` and `PointTransactionReason`. Add the `QuotationStatus` enum and `Quotation`/`QuotationItem` models. Add `outstanding`/`voidReason`/`voidedById`/`voidedAt` to `Sale`, naming its two `User` relations. Add the back-relations listed in *Data Model*.
- [ ] **Step 2:** Migrate: `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name receipts_quotations && cd ../..` — ends with `Your database is now in sync`.
- [ ] **Step 3:** Commit: `feat(api): add void fields and quotation models with migration`.

## Task 2: Seed — void & quotation permissions

**Files:** Modify `apps/api/src/seed/catalog.ts`, `apps/api/src/seed/index.test.ts`.

- [ ] **Step 1:** Append `sales.void`, `quotations.view`, `quotations.manage` to `PERMISSIONS`. Grant `quotations.view`+`quotations.manage` to `manager`/`cashier`; `sales.void` to `manager`; `quotations.view` to `account`.
- [ ] **Step 2:** Update `index.test.ts` — `cashier.permissions` length becomes `9`.
- [ ] **Step 3:** Run the API suite — PASS. Apply to dev DB via `npx prisma db seed`.
- [ ] **Step 4:** Commit: `feat(api): seed void and quotation permissions`.

## Task 3: Checkout — deposit / partial payment support — TDD

**Files:** Modify `apps/api/src/sales/checkout.ts`, `apps/api/src/sales/checkout.test.ts`.

- [ ] **Step 1:** Update `checkout.test.ts`: change the old "payment must equal total" case to expect `OVERPAYMENT` for a payment **above** the total; add a case where payments sum to **less than** total → the sale succeeds with `outstanding === total - paid`; add a `NO_PAYMENT` case for an empty/zero payment.
- [ ] **Step 2:** Run — the deposit/overpayment cases FAIL.
- [ ] **Step 3:** In `checkout.ts` replace the `paymentSum !== total` check: throw `CheckoutError("NO_PAYMENT", …)` when `paymentSum <= 0`, `CheckoutError("OVERPAYMENT", …)` when `paymentSum > total`. Set `outstanding: total - paymentSum` on the created `Sale`.
- [ ] **Step 4:** Run — PASS (Phase 5's full-payment cases still pass: `outstanding` is 0 when fully paid).
- [ ] **Step 5:** Commit: `feat(api): support deposit (partial-payment) sales at checkout`.

## Task 4: Void service — TDD  *(core business logic)*

**Files:** Create `apps/api/src/sales/void.ts` + `void.test.ts`.

- [ ] **Step 1:** Write `void.test.ts` against a real DB (reuse a checkout fixture). Cases:
  - voiding a completed sale flips its status to `VOIDED` and records `voidedById`/`voidReason`/`voidedAt`.
  - every sold unit returns to stock (a `REFUND` movement per line; the stock level is back to its pre-sale quantity).
  - for a member: redeemed points are returned, earned points are clawed back, and `lifetimeSpend` drops by the sale total.
  - the earn clawback is clamped — if the member's balance is below the earned amount, the balance floors at 0 rather than throwing.
  - voiding an already-`VOIDED` sale throws `VoidError` code `ALREADY_VOIDED`; an unknown id → `NOT_FOUND`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `void.ts`:
  ```typescript
  export class VoidError extends Error {
    constructor(public code: string, message: string) { super(message); }
  }
  ```
  `voidSale(saleId, voidedById, reason?)` runs one `prisma.$transaction`:
  1. Load the sale with `items`; `NOT_FOUND` if missing, `ALREADY_VOIDED` if `status === "VOIDED"`.
  2. For each item, `applyStockMovement(tx, { …, delta: +quantity, reason: "REFUND", saleId, userId: voidedById })`.
  3. If `customerId`: when `pointsRedeemed > 0`, `applyPointTransaction(+pointsRedeemed, "REFUND")`; then read the customer, `clawback = Math.min(pointsEarned, customer.pointsBalance)`, and when `clawback > 0`, `applyPointTransaction(-clawback, "REFUND")`; then `customer.update` `lifetimeSpend: { decrement: total }`.
  4. `sale.update` → `status: "VOIDED"`, `voidReason`, `voidedById`, `voidedAt: new Date()`; return it with relations.
- [ ] **Step 4:** Run — PASS. Commit: `feat(api): add sale void (full refund) service`.

## Task 5: Void / settle / outstanding routes — TDD

**Files:** Modify `apps/api/src/routes/sales.ts`, `apps/api/src/routes/sales.test.ts`.

- [ ] **Step 1:** Add test cases — `POST /api/sales/:id/void` with `sales.void` voids (200); without it → 403; already voided → 400 `ALREADY_VOIDED`; a branch-scoped user voiding another branch → 403 `BRANCH_FORBIDDEN`. A deposit checkout leaves `outstanding > 0`; `POST /api/sales/:id/settle` reduces it; settling more than `outstanding` → 400 `OVERPAYMENT`. `GET /api/sales/outstanding` lists only `COMPLETED` sales with `outstanding > 0`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Add the routes to `saleRoutes`:
  - `POST /api/sales/:id/void` (`sales.void`) — load the sale for the branch-scope check (`BRANCH_FORBIDDEN`); call `voidSale`; map `VoidError` → 400 with `err.code`.
  - `POST /api/sales/:id/settle` (`sales.create`) — schema `{ method, amount }`; in a transaction, re-load the sale, reject if `VOIDED` or `amount <= 0` or `amount > outstanding` (`OVERPAYMENT`), create the `Payment`, decrement `outstanding`.
  - `GET /api/sales/outstanding` (`sales.view`) — `where: { status: "COMPLETED", outstanding: { gt: 0 }, ...branchFilter }`.
  Register before nothing special — Fastify prefers static routes over `:id`.
- [ ] **Step 4:** Run — PASS; run the full API suite. Commit: `feat(api): add void, settle, and outstanding sales routes`.

## Task 6: Quotation service & checkout refactor — TDD

**Files:** Modify `apps/api/src/sales/checkout.ts`; create `apps/api/src/sales/quotation.ts` + `quotation.test.ts`. Add `formatQuotationNumber` to `apps/api/src/sales/numbering.ts`.

- [ ] **Step 1:** Refactor `checkout.ts` — extract the body of the `prisma.$transaction` callback into an exported `checkoutInTx(tx, args)`; `checkout(args)` becomes `prisma.$transaction((tx) => checkoutInTx(tx, args))`. No behaviour change — the Phase 5 + Task 3 checkout tests must still pass unchanged.
- [ ] **Step 2:** Add `formatQuotationNumber(code, n)` → `` `${code}-Q${String(n).padStart(6, "0")}` `` to `numbering.ts`.
- [ ] **Step 3:** Write `quotation.test.ts` — `createQuotation` snapshots line prices and a `subtotal`, numbers per branch, and touches **no** stock; `convertQuotation` produces a `Sale`, decrements stock, and marks the quotation `CONVERTED` with `convertedSaleId` set; converting an already-`CONVERTED` quotation throws `QuotationError` `ALREADY_CONVERTED`.
- [ ] **Step 4:** Run — FAIL.
- [ ] **Step 5:** Implement `quotation.ts`: `createQuotation(args)` — load products, snapshot `QuotationItem`s, `nextNumber(tx, branchId, "quote")`, create the `Quotation` + items. `convertQuotation(args)` — one `prisma.$transaction`: load the quotation (`NOT_FOUND`; `ALREADY_CONVERTED` if not `OPEN`), call `checkoutInTx(tx, { … quotation items … })`, `quotation.update` → `status: "CONVERTED"`, `convertedSaleId`; return the sale. `QuotationError` carries a `code`.
- [ ] **Step 6:** Run — PASS. Commit: `feat(api): add quotation create and convert service`.

## Task 7: Quotation routes — TDD

**Files:** Create `apps/api/src/routes/quotations.ts` + `.test.ts`; modify `apps/api/src/app.ts`.

- [ ] **Step 1:** Write `quotations.test.ts` — create requires `quotations.manage` (viewer → 403); list/detail require `quotations.view` and are branch-scoped; convert produces a sale and 409/400s on a second convert; a branch-scoped user acting on another branch → 403.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `quotationRoutes` (`POST`/`GET`/`GET :id`/`POST :id/convert`) calling the Task 6 services; branch-scoped users restricted to their branch on create and convert; map `QuotationError`/`CheckoutError`/`StockError` to `400`. Register in `app.ts`.
- [ ] **Step 4:** Run — PASS; run the full API suite and `npm run build --workspace apps/api`. Commit: `feat(api): add quotation routes`.

## Task 8: Web — void, settle & outstanding UI

**Files:** Modify `apps/web/src/api/sales.ts`, `apps/web/src/views/ReceiptView.vue`; create `apps/web/src/views/OutstandingView.vue`; add i18n keys.

- [ ] **Step 1:** Add i18n keys (`void`, `voided`, `settle`, `outstanding`, `quotations`, `quotation`, `validUntil`, `convert`, `reason`) to `th.ts`/`en.ts`.
- [ ] **Step 2:** Extend `api/sales.ts` — `Sale` gains `status`/`outstanding`/`voidReason`; add `voidSale(id, reason)`, `settleSale(id, method, amount)`, `fetchOutstanding()`.
- [ ] **Step 3:** Update `ReceiptView.vue` — show a `VOIDED` banner; for `sales.void` users a void button (with a reason prompt); when `outstanding > 0`, show the balance and — for `sales.create` users — a settle form. Reload after either action.
- [ ] **Step 4:** Create `OutstandingView.vue` — table of sales with an outstanding balance, each linking to its receipt.
- [ ] **Step 5:** Commit: `feat(web): add void, settle, and outstanding UI`.

## Task 9: Web — quotation API & views

**Files:** Create `apps/web/src/api/quotations.ts`, `apps/web/src/views/QuotationListView.vue`, `QuotationFormView.vue`, `QuotationDetailView.vue`.

- [ ] **Step 1:** `api/quotations.ts` — `Quotation`/`QuotationItem` interfaces; `fetchQuotations`, `fetchQuotation`, `createQuotation`, `convertQuotation`.
- [ ] **Step 2:** `QuotationListView.vue` — table (number, customer, subtotal, status), `+` link gated on `quotations.manage`.
- [ ] **Step 3:** `QuotationFormView.vue` — pick a branch and products into lines (like the POS cart), optional customer, then create.
- [ ] **Step 4:** `QuotationDetailView.vue` — show items + subtotal + status; for an `OPEN` quotation a "Convert" action (`quotations.manage`) that posts a cash payment for the subtotal and routes to the resulting receipt.
- [ ] **Step 5:** Commit: `feat(web): add quotation API module and views`.

## Task 10: Web — router & nav wiring + build

**Files:** Modify `apps/web/src/router/index.ts`, `apps/web/src/App.vue`.

- [ ] **Step 1:** Add routes: `/outstanding` (`sales.view`), `/quotations` (`quotations.view`), `/quotations/new` (`quotations.manage`), `/quotations/:id` (`quotations.view`). Lazy-import; place `/quotations/new` before `/quotations/:id`.
- [ ] **Step 2:** Add nav `RouterLink`s for outstanding and quotations, permission-gated.
- [ ] **Step 3:** Run `npm test --workspace apps/web` and `npm run build --workspace apps/web` (exit 0).
- [ ] **Step 4:** Manual end-to-end smoke check against a live API: ring up a deposit sale and confirm the outstanding balance, settle it, void a sale and confirm stock/points reversed, create a quotation and convert it.
- [ ] **Step 5:** Commit: `feat(web): wire outstanding and quotation routes`.

---

## Self-Review Notes

- **Spec coverage (§5, §13):** refund/void — a full reversal of stock, points, and spend ✓ (Task 4); deposit / outstanding balances ✓ (Tasks 3, 5 — `Sale.outstanding`, the settle endpoint); quotations + quotation items, with conversion to a sale ✓ (Tasks 1, 6, 7). Per-branch numbering extends to quotations via the Phase 5 `number_sequences` (`kind = "quote"`).
- **Atomicity:** `checkout` is refactored into `checkoutInTx(tx, args)` so `convertQuotation` runs the checkout **and** the quotation status flip inside one transaction — a conversion can never half-apply. Voiding is likewise one transaction.
- **Point clawback:** a void claws back earned points clamped to the member's current balance, so a void never fails because the customer already spent the points and the balance never goes negative — a deliberate, lenient v1 policy.
- **Checkout rule change:** the Phase 5 "payments must equal total" rule becomes "payments must be > 0 and ≤ total"; the one Phase 5 checkout test asserting the old behaviour is updated in Task 3 to assert `OVERPAYMENT`. Fully-paid sales are unaffected (`outstanding` is 0).
- **Scope:** refunds are modelled as a full-sale void; partial line-item refunds (proportional discount/point allocation) are intentionally deferred. The SSE `sale.completed`/`stock.changed` push, Z-reports, and the daily report are Phase 8.
- **Test isolation:** `resetAuthTables` gains `quotationItem`/`quotation` deletes in FK-safe order (before `product`/`customer`/`branch`); `fileParallelism: false` keeps the shared-DB suites serial.

## Next Phase

Phase 7 (Delivery — zones, channels, teams, drivers, delivery status) gets its own plan once Phase 6 is complete and reviewed.
