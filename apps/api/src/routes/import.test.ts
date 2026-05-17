import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("import routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("imports products, auto-creating categories, and reports duplicates", async () => {
    await prisma.category.create({ data: { name: "เก่า" } });
    await prisma.product.create({
      data: {
        sku: "DUP",
        name: "เดิม",
        basePrice: 1,
        category: { connect: { name: "เก่า" } },
      },
    });
    const adminId = await createTestUser({ username: "admin", permissions: ["data.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/import/products",
      cookies: await sessionCookie(adminId),
      payload: {
        rows: [
          { sku: "NEW1", name: "ใหม่ 1", category: "โซฟา", basePrice: 9900 },
          { sku: "DUP", name: "ซ้ำ", category: "โซฟา", basePrice: 100 },
        ],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().created).toBe(1);
    expect(res.json().errors).toHaveLength(1);
    expect(await prisma.category.findUnique({ where: { name: "โซฟา" } })).not.toBeNull();
  });

  it("imports customers and reports duplicate phones", async () => {
    await prisma.customer.create({ data: { name: "เดิม", phone: "0810000000" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["data.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/import/customers",
      cookies: await sessionCookie(adminId),
      payload: {
        rows: [
          { name: "ใหม่", phone: "0899999999" },
          { name: "ซ้ำ", phone: "0810000000" },
        ],
      },
    });
    await app.close();
    expect(res.json().created).toBe(1);
    expect(res.json().errors).toHaveLength(1);
  });

  it("imports stock as IMPORT movements and reports unknown references", async () => {
    const category = await prisma.category.create({ data: { name: "หมวด" } });
    await prisma.product.create({
      data: { sku: "P1", name: "สินค้า", categoryId: category.id, basePrice: 100 },
    });
    await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["data.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/import/stock",
      cookies: await sessionCookie(adminId),
      payload: {
        rows: [
          { sku: "P1", branchCode: "SH", quantity: 25 },
          { sku: "NOPE", branchCode: "SH", quantity: 5 },
        ],
      },
    });
    await app.close();
    expect(res.json().created).toBe(1);
    expect(res.json().errors).toHaveLength(1);
    const movements = await prisma.stockMovement.count({ where: { reason: "IMPORT" } });
    expect(movements).toBe(1);
  });

  it("rejects import without data.manage", async () => {
    const userId = await createTestUser({ username: "nobody", permissions: [] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/import/products",
      cookies: await sessionCookie(userId),
      payload: { rows: [] },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });
});
