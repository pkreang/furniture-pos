import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

interface Fixture {
  branchId: number;
  otherBranchId: number;
  productId: number;
}

async function fixture(): Promise<Fixture> {
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const other = await prisma.branch.create({ data: { name: "อีกสาขา", code: "SH2" } });
  const product = await prisma.product.create({
    data: { sku: "P", name: "สินค้า", categoryId: category.id, basePrice: 1000 },
  });
  for (const branchId of [branch.id, other.id]) {
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId: product.id, branchId, delta: 50, reason: "ADJUST" }),
    );
  }
  return { branchId: branch.id, otherBranchId: other.id, productId: product.id };
}

describe("sales routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rings up a sale with sales.create", async () => {
    const f = await fixture();
    const cashierId = await createTestUser({ username: "cashier", permissions: ["sales.create"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sales",
      cookies: await sessionCookie(cashierId),
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 2 }],
        payments: [{ method: "CASH", amount: 2000 }],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().number).toBe("SH-000001");
    expect(res.json().total).toBe(2000);
  });

  it("rejects checkout without sales.create", async () => {
    const f = await fixture();
    const viewerId = await createTestUser({ username: "viewer", permissions: ["sales.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sales",
      cookies: await sessionCookie(viewerId),
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 1 }],
        payments: [{ method: "CASH", amount: 1000 }],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("forbids a branch-scoped cashier selling another branch", async () => {
    const f = await fixture();
    const cashierId = await createTestUser({
      username: "cashier",
      permissions: ["sales.create"],
      isBranchScoped: true,
      branchId: f.branchId,
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sales",
      cookies: await sessionCookie(cashierId),
      payload: {
        branchId: f.otherBranchId,
        items: [{ productId: f.productId, quantity: 1 }],
        payments: [{ method: "CASH", amount: 1000 }],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("BRANCH_FORBIDDEN");
  });

  it("returns 400 with the error code on insufficient stock", async () => {
    const f = await fixture();
    const cashierId = await createTestUser({ username: "cashier", permissions: ["sales.create"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sales",
      cookies: await sessionCookie(cashierId),
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 9999 }],
        payments: [{ method: "CASH", amount: 9999000 }],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INSUFFICIENT_STOCK");
  });

  it("rejects a discount above the cashier's role cap", async () => {
    const f = await fixture();
    const cashierId = await createTestUser({
      username: "cashier",
      permissions: ["sales.create"],
    });
    // createTestUser roles have discountMaxPercent null by default → unlimited;
    // create a capped role explicitly.
    await prisma.role.update({ where: { key: "tester" }, data: { discountMaxPercent: 5 } });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sales",
      cookies: await sessionCookie(cashierId),
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 1 }],
        payments: [{ method: "CASH", amount: 800 }],
        discountPercent: 20,
      },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("DISCOUNT_TOO_HIGH");
  });

  it("lists and shows sales with sales.view", async () => {
    const f = await fixture();
    const cashierId = await createTestUser({
      username: "cashier",
      permissions: ["sales.create", "sales.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(cashierId);

    const created = await app.inject({
      method: "POST",
      url: "/api/sales",
      cookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 1 }],
        payments: [{ method: "CASH", amount: 1000 }],
      },
    });
    const saleId = created.json().id;

    const list = await app.inject({ method: "GET", url: "/api/sales", cookies });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const detail = await app.inject({ method: "GET", url: `/api/sales/${saleId}`, cookies });
    await app.close();
    expect(detail.statusCode).toBe(200);
    expect(detail.json().items).toHaveLength(1);
    expect(detail.json().payments).toHaveLength(1);
    expect(detail.json().taxInvoice.type).toBe("ABBREVIATED");
  });

  it("returns the company settings to any authenticated user", async () => {
    await prisma.appSetting.create({ data: { key: "company.name", value: "ร้านทดสอบ" } });
    const userId = await createTestUser({ username: "anyone", permissions: [] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/settings",
      cookies: await sessionCookie(userId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()["company.name"]).toBe("ร้านทดสอบ");
  });
});
