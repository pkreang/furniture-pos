import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { runSeed } from "../seed/index.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

async function makeCategory(name = "หมวด"): Promise<number> {
  const c = await prisma.category.create({ data: { name } });
  return c.id;
}

describe("products routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists products and filters by categoryId", async () => {
    const catA = await makeCategory("A");
    const catB = await makeCategory("B");
    await prisma.product.create({ data: { sku: "P1", name: "โซฟา", categoryId: catA, basePrice: 9900 } });
    await prisma.product.create({ data: { sku: "P2", name: "เตียง", categoryId: catB, basePrice: 5000 } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["catalog.view"] });
    const app = buildApp();

    const all = await app.inject({
      method: "GET",
      url: "/api/products",
      cookies: await sessionCookie(viewerId),
    });
    expect(all.statusCode).toBe(200);
    expect(all.json()).toHaveLength(2);

    const filtered = await app.inject({
      method: "GET",
      url: `/api/products?categoryId=${catA}`,
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(filtered.json()).toHaveLength(1);
    expect(filtered.json()[0].sku).toBe("P1");
  });

  it("creates a product with catalog.manage", async () => {
    const categoryId = await makeCategory();
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/products",
      cookies: await sessionCookie(adminId),
      payload: { sku: "SOFA-1", name: "โซฟา 3 ที่นั่ง", categoryId, basePrice: 19900, isSofa: true },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().sku).toBe("SOFA-1");
    expect(res.json().isSofa).toBe(true);
  });

  it("rejects creating a product without catalog.manage", async () => {
    const categoryId = await makeCategory();
    const viewerId = await createTestUser({ username: "viewer", permissions: ["catalog.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/products",
      cookies: await sessionCookie(viewerId),
      payload: { sku: "X1", name: "x", categoryId, basePrice: 100 },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("rejects a duplicate sku with 409", async () => {
    const categoryId = await makeCategory();
    await prisma.product.create({ data: { sku: "DUP", name: "a", categoryId, basePrice: 1 } });
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/products",
      cookies: await sessionCookie(adminId),
      payload: { sku: "DUP", name: "b", categoryId, basePrice: 2 },
    });
    await app.close();
    expect(res.statusCode).toBe(409);
  });

  it("updates a product with catalog.manage", async () => {
    const categoryId = await makeCategory();
    const product = await prisma.product.create({
      data: { sku: "U1", name: "เดิม", categoryId, basePrice: 100 },
    });
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/products/${product.id}`,
      cookies: await sessionCookie(adminId),
      payload: { name: "ใหม่", basePrice: 250 },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("ใหม่");
    expect(res.json().basePrice).toBe(250);
  });

  it("lists seeded sofa materials with their colors", async () => {
    process.env.SEED_ADMIN_USERNAME = "seed-admin";
    process.env.SEED_ADMIN_PASSWORD = "seed-pw-x";
    await runSeed(prisma);
    const viewerId = await createTestUser({ username: "viewer", permissions: ["catalog.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/sofa-materials",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(4);
    const luxury = res.json().find((m: { key: string }) => m.key === "luxury");
    expect(luxury.priceMultiplierPct).toBe(210);
    expect(luxury.colors.length).toBeGreaterThan(0);
  });
});
