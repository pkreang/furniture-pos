import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

async function fixture(): Promise<{ productId: number; branchA: number; branchB: number }> {
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const product = await prisma.product.create({
    data: { sku: "SKU1", name: "สินค้า", categoryId: category.id, basePrice: 100 },
  });
  const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "TA" } });
  const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "TB" } });
  return { productId: product.id, branchA: branchA.id, branchB: branchB.id };
}

async function seedLevel(productId: number, branchId: number, qty: number): Promise<void> {
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId, branchId, delta: qty, reason: "ADJUST" }),
  );
}

describe("transfer routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("transfers stock between branches with stock.adjust", async () => {
    const { productId, branchA, branchB } = await fixture();
    await seedLevel(productId, branchA, 15);
    const adminId = await createTestUser({ username: "admin", permissions: ["stock.adjust"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/transfers",
      cookies: await sessionCookie(adminId),
      payload: { productId, fromBranchId: branchA, toBranchId: branchB, quantity: 6 },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().quantity).toBe(6);

    const a = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId, branchId: branchA } },
    });
    expect(a.quantity).toBe(9);
  });

  it("rejects a transfer that exceeds source stock", async () => {
    const { productId, branchA, branchB } = await fixture();
    await seedLevel(productId, branchA, 4);
    const adminId = await createTestUser({ username: "admin", permissions: ["stock.adjust"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/transfers",
      cookies: await sessionCookie(adminId),
      payload: { productId, fromBranchId: branchA, toBranchId: branchB, quantity: 10 },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INSUFFICIENT_STOCK");
    expect(await prisma.transfer.count()).toBe(0);
  });

  it("forbids a branch-scoped user transferring out of another branch", async () => {
    const { productId, branchA, branchB } = await fixture();
    await seedLevel(productId, branchA, 10);
    const managerId = await createTestUser({
      username: "manager",
      permissions: ["stock.adjust"],
      isBranchScoped: true,
      branchId: branchB,
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/transfers",
      cookies: await sessionCookie(managerId),
      payload: { productId, fromBranchId: branchA, toBranchId: branchB, quantity: 2 },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("BRANCH_FORBIDDEN");
  });

  it("lists transfers, branch-scoped to from- or to-branch", async () => {
    const { productId, branchA, branchB } = await fixture();
    await seedLevel(productId, branchA, 20);
    const adminId = await createTestUser({ username: "admin", permissions: ["stock.adjust", "stock.view"] });
    const app = buildApp();
    await app.inject({
      method: "POST",
      url: "/api/transfers",
      cookies: await sessionCookie(adminId),
      payload: { productId, fromBranchId: branchA, toBranchId: branchB, quantity: 5 },
    });

    const managerId = await createTestUser({
      username: "manager",
      roleKey: "manager-role",
      permissions: ["stock.view"],
      isBranchScoped: true,
      branchId: branchB,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/transfers",
      cookies: await sessionCookie(managerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].toBranchId).toBe(branchB);
  });
});
