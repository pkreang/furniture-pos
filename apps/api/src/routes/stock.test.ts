import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

async function makeProduct(sku = "SKU"): Promise<number> {
  const category = await prisma.category.findFirst() ?? (await prisma.category.create({ data: { name: "หมวด" } }));
  const product = await prisma.product.create({
    data: { sku, name: "สินค้า", categoryId: category.id, basePrice: 100 },
  });
  return product.id;
}

async function seedLevel(productId: number, branchId: number, qty: number): Promise<void> {
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId, branchId, delta: qty, reason: "ADJUST" }),
  );
}

describe("stock routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists stock levels for a user with stock.view", async () => {
    const branch = await prisma.branch.create({ data: { name: "สาขา", code: "S1" } });
    const productId = await makeProduct();
    await seedLevel(productId, branch.id, 7);
    const viewerId = await createTestUser({ username: "viewer", permissions: ["stock.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/stock",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].quantity).toBe(7);
  });

  it("scopes the stock list to a branch-scoped user's own branch", async () => {
    const own = await prisma.branch.create({ data: { name: "ของฉัน", code: "OWN" } });
    const other = await prisma.branch.create({ data: { name: "อื่น", code: "OTH" } });
    const productId = await makeProduct();
    await seedLevel(productId, own.id, 3);
    await seedLevel(productId, other.id, 9);
    const managerId = await createTestUser({
      username: "manager",
      permissions: ["stock.view"],
      isBranchScoped: true,
      branchId: own.id,
    });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/stock",
      cookies: await sessionCookie(managerId),
    });
    await app.close();
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].branchId).toBe(own.id);
  });

  it("adjusts stock and records a movement with stock.adjust", async () => {
    const branch = await prisma.branch.create({ data: { name: "สาขา", code: "ADJ" } });
    const productId = await makeProduct();
    await seedLevel(productId, branch.id, 5);
    const adminId = await createTestUser({ username: "admin", permissions: ["stock.view", "stock.adjust"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/stock/adjust",
      cookies: await sessionCookie(adminId),
      payload: { productId, branchId: branch.id, delta: 4, note: "นับสต็อก" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().quantity).toBe(9);
    expect(await prisma.stockMovement.count({ where: { reason: "ADJUST" } })).toBe(2);
  });

  it("rejects an adjustment that would drive stock negative", async () => {
    const branch = await prisma.branch.create({ data: { name: "สาขา", code: "NEG" } });
    const productId = await makeProduct();
    await seedLevel(productId, branch.id, 2);
    const adminId = await createTestUser({ username: "admin", permissions: ["stock.adjust"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/stock/adjust",
      cookies: await sessionCookie(adminId),
      payload: { productId, branchId: branch.id, delta: -10 },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INSUFFICIENT_STOCK");
  });

  it("forbids a branch-scoped user adjusting another branch", async () => {
    const own = await prisma.branch.create({ data: { name: "ของฉัน", code: "MINE" } });
    const other = await prisma.branch.create({ data: { name: "อื่น", code: "THEM" } });
    const productId = await makeProduct();
    await seedLevel(productId, other.id, 5);
    const managerId = await createTestUser({
      username: "manager",
      permissions: ["stock.adjust"],
      isBranchScoped: true,
      branchId: own.id,
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/stock/adjust",
      cookies: await sessionCookie(managerId),
      payload: { productId, branchId: other.id, delta: 1 },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("BRANCH_FORBIDDEN");
  });

  it("lists recent stock movements", async () => {
    const branch = await prisma.branch.create({ data: { name: "สาขา", code: "MOV" } });
    const productId = await makeProduct();
    await seedLevel(productId, branch.id, 5);
    const viewerId = await createTestUser({ username: "viewer", permissions: ["stock.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/stock/movements",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });
});
