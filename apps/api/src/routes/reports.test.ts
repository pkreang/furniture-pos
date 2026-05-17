import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { checkout } from "../sales/checkout.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

interface Fixture {
  branchId: number;
  productId: number;
  cashierId: number;
}

async function fixture(): Promise<Fixture> {
  const cashierId = await createTestUser({ username: "c", permissions: ["sales.create"] });
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const product = await prisma.product.create({
    data: { sku: "P", name: "สินค้า", categoryId: category.id, basePrice: 1000 },
  });
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId: product.id, branchId: branch.id, delta: 100, reason: "ADJUST" }),
  );
  return { branchId: branch.id, productId: product.id, cashierId };
}

const todayISO = (): string => new Date().toISOString().slice(0, 10);

describe("report routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("generates a Z-report with reports.generate", async () => {
    const f = await fixture();
    await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productId, quantity: 1 }],
      payments: [{ method: "CASH", amount: 1000 }],
      maxDiscountPercent: null,
    });
    const userId = await createTestUser({
      username: "u",
      roleKey: "mgr",
      permissions: ["reports.generate", "reports.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const res = await app.inject({
      method: "POST",
      url: "/api/z-reports",
      cookies,
      payload: { branchId: f.branchId, businessDate: todayISO() },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().grossTotal).toBe(1000);

    const dup = await app.inject({
      method: "POST",
      url: "/api/z-reports",
      cookies,
      payload: { branchId: f.branchId, businessDate: todayISO() },
    });
    await app.close();
    expect(dup.statusCode).toBe(409);
  });

  it("rejects generating a Z-report without reports.generate", async () => {
    const f = await fixture();
    const viewerId = await createTestUser({
      username: "v",
      roleKey: "viewer",
      permissions: ["reports.view"],
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/z-reports",
      cookies: await sessionCookie(viewerId),
      payload: { branchId: f.branchId, businessDate: todayISO() },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("returns dashboard figures", async () => {
    const f = await fixture();
    await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productId, quantity: 2 }],
      payments: [{ method: "CASH", amount: 1500 }], // deposit → outstanding 500
      maxDiscountPercent: null,
    });
    const userId = await createTestUser({ username: "u", roleKey: "mgr", permissions: ["reports.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/dashboard",
      cookies: await sessionCookie(userId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.todaySalesCount).toBe(1);
    expect(body.todaySalesTotal).toBe(2000);
    expect(body.outstandingTotal).toBe(500);
  });
});
