import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("export routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("exports products, customers, and stock as JSON rows", async () => {
    const category = await prisma.category.create({ data: { name: "โซฟา" } });
    const product = await prisma.product.create({
      data: { sku: "P1", name: "โซฟา", categoryId: category.id, basePrice: 9900 },
    });
    const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId: product.id, branchId: branch.id, delta: 12, reason: "ADJUST" }),
    );
    await prisma.customer.create({ data: { name: "ลูกค้า", phone: "0810000000" } });

    const adminId = await createTestUser({ username: "admin", permissions: ["data.manage"] });
    const app = buildApp();
    const cookies = await sessionCookie(adminId);

    const products = await app.inject({ method: "GET", url: "/api/export/products", cookies });
    expect(products.json()[0]).toMatchObject({ sku: "P1", category: "โซฟา", basePrice: 9900 });

    const customers = await app.inject({ method: "GET", url: "/api/export/customers", cookies });
    expect(customers.json()[0].phone).toBe("0810000000");

    const stock = await app.inject({ method: "GET", url: "/api/export/stock", cookies });
    await app.close();
    expect(stock.json()[0]).toMatchObject({ sku: "P1", branchCode: "SH", quantity: 12 });
  });

  it("rejects export without data.manage", async () => {
    const userId = await createTestUser({ username: "nobody", permissions: [] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/export/products",
      cookies: await sessionCookie(userId),
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });
});
