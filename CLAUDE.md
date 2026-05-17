# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Repository status: production rebuild in progress

This repository is being rebuilt into a production system. The original vanilla
HTML/CSS/JS demo described below has been **moved to `legacy-demo/`** and is kept
for reference only.

The new system is a Node monorepo (npm workspaces): `apps/api` (Fastify + Prisma)
and `apps/web` (Vue 3 + Vite). See `README.md` for local development, and
`docs/superpowers/specs/` and `docs/superpowers/plans/` for the design and plans.

The sections below document the **legacy demo** (now under `legacy-demo/`). They
will be rewritten for the new architecture as that work progresses.

## What this is

A multi-branch furniture-store POS web app (Thai-language UI). It is a single-page
application built with **vanilla HTML/CSS/JS — no framework, no build step, no
dependencies installed locally**. The only external dependency is SheetJS (xlsx),
loaded from a CDN in `index.html`.

## Running / developing

There is no package.json, no test suite, and no linter. To run:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Open `index.html` directly via `file://` also works, but a static server is
preferred (the CDN xlsx script and Google Fonts both need network access).

**Cache-busting gotcha:** `index.html` loads `data.js?v=21`, `app.js?v=21`, and
`styles.css?v=22` with `?v=` query strings. After editing any of those files,
bump the matching `?v=` number in `index.html` or the browser will serve a stale
cached copy.

## Architecture

Three source files, each a single global script (no modules):

- **`data.js`** — the data store. Defines two globals: `AppData` (all domain data:
  branches, products, customers, users, roles, i18n dictionaries, delivery config,
  settings) and `State` (live UI/session state). Also defines low-level helpers
  (`t()`, `hasPermission()`, `formatCurrency()`, `getCurrentBranch()`, `logAction()`,
  tier/points math, `hashPassword()`).
- **`app.js`** — all rendering, event handling, and modals (~6900 lines).
- **`index.html`** — static shell: login overlay, sidebar, topbar, `#main-content`.
- **`styles.css`** — all styling, including a `body.dark` dark-mode variant.

### State model

Everything lives in memory in the `AppData` and `State` globals. **There is no
backend and almost no persistence** — receipts, quotation, customer edits, stock
changes, and audit logs all reset on page reload. `localStorage` is used only for
three small keys: `fh_dark` (dark mode), `fh_lang` (language), and `fh_user` (the
logged-in user id, for session restore). Mutate `State`/`AppData` directly, then
call `render()`.

### Render cycle

`render()` → `renderSidebar()` + `renderMain()`. `renderMain()` maps
`State.currentPage` to one `renderXxx()` function (see the `pages` map in
`renderMain`, app.js ~465). Each `renderXxx()` **returns an HTML string** built
from template literals; `renderMain` assigns it to `#main-content.innerHTML`, then
calls `attachEvents()`.

`attachEvents()` is one large function that re-binds **every** page's event
listeners via `querySelectorAll` on each render. When adding interactive elements,
add their listener wiring inside `attachEvents()`.

### Modals

Modals are not part of the render cycle. An `openXxxModal()` function imperatively
creates a `div.modal-overlay`, sets its `innerHTML`, wires its own listeners, and
appends it to `document.body`. Closing is `modal.remove()`. After a modal mutates
data it typically calls `render()` or `renderMain()` to refresh the page behind it.

### Permissions & roles (RBAC)

`AppData.roles` maps a role key → `{ permissions: [...] }`, where `"*"` grants
everything. `hasPermission(perm)` is the gate; `renderMain()` blocks a page if the
user lacks its `perm`. `scopedToBranch` roles (manager, cashier) are restricted to
their own `branchId` — see `isBranchScoped()` / `canAccessBranch()`. Managers and
cashiers also have a `discountMaxPercent` cap enforced via `getMaxDiscountPercent()`.

### Auth

`login()` hashes the entered password with `hashPassword()` (cyrb53 — demo only,
not production-grade) and matches against `AppData.users`. All seed users share
password `1234`, hashed in place on load. Demo accounts: `owner`, `admin`,
`siam_mgr`, `cashier1`, `account`.

### i18n

UI strings come from `AppData.i18n.{th,en}`; `t(key, fallback)` resolves the
current language (`State.language`, default `th`). Add new strings to **both**
dictionaries. The UI is Thai-first.

### Cross-tab sync

`broadcastEvent()` / a `BroadcastChannel("furniture-pos-sync")` listener sync
events (e.g. `sale.completed`, `stock.changed`) across open browser tabs,
re-rendering relevant pages. Gated by `AppData.appSettings.enableRealtimeSync`.

## Domain notes

- **Branches**: 4 locations; a branch flagged `isWarehouse` is storage-only and
  cannot sell. Stock is per-product per-branch: `product.stock[branchId]`.
- **Sofa builder**: sofas support 4 material grades (`AppData.sofaMaterials`) with
  a `priceMultiplier`, plus per-material color palettes (`AppData.sofaColors`).
- **Delivery**: composed of zones, channels (in-house team vs. 3rd-party couriers),
  teams, drivers, time slots, and a status state machine (`AppData.deliveryStatuses`).
- **Sales artifacts**: quotations, receipts, refunds, outstanding (deposit) balances,
  and end-of-day Z-reports — each with its own `renderXxx()` page.
- **Daily report**: `generateDailyReportContent()` builds an email/LINE summary;
  `startDailyReportTimer()` schedules it. No real send — it is simulated.
- **Membership**: customers earn points by spend, with bronze/silver/gold/platinum
  tiers (`AppData.tiers`, `getTierKey()`, `calcPointsEarned()`).
- **Excel**: import/export via SheetJS — `exportXLSX()` / `readXLSX()` and the
  `exportXxxXLSX` / `importXxxXLSX` functions.
