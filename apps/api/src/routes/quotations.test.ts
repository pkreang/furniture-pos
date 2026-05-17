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
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId: product.id, branchId: branch.id, delta: 50, reason: "ADJUST" }),
  );
  return { branchId: branch.id, otherBranchId: other.id, productId: product.id };
}

describe("quotation routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a quotation with quotations.manage", async () => {
    const f = await fixture();
    const userId = await createTestUser({ username: "u", permissions: ["quotations.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/quotations",
      cookies: await sessionCookie(userId),
      payload: { branchId: f.branchId, items: [{ productId: f.productId, quantity: 2 }] },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().number).toBe("SH-Q000001");
    expect(res.json().subtotal).toBe(2000);
  });

  it("rejects creating a quotation without quotations.manage", async () => {
    const f = await fixture();
    const viewerId = await createTestUser({ username: "v", permissions: ["quotations.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/quotations",
      cookies: await sessionCookie(viewerId),
      payload: { branchId: f.branchId, items: [{ productId: f.productId, quantity: 1 }] },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("lists and shows quotations with quotations.view", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      permissions: ["quotations.manage", "quotations.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/quotations",
      cookies,
      payload: { branchId: f.branchId, items: [{ productId: f.productId, quantity: 1 }] },
    });
    const id = created.json().id;

    const list = await app.inject({ method: "GET", url: "/api/quotations", cookies });
    expect(list.json()).toHaveLength(1);

    const detail = await app.inject({ method: "GET", url: `/api/quotations/${id}`, cookies });
    await app.close();
    expect(detail.statusCode).toBe(200);
    expect(detail.json().items).toHaveLength(1);
  });

  it("converts a quotation into a sale and rejects a second convert", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      permissions: ["quotations.manage", "sales.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/quotations",
      cookies,
      payload: { branchId: f.branchId, items: [{ productId: f.productId, quantity: 3 }] },
    });
    const id = created.json().id;

    const convert = await app.inject({
      method: "POST",
      url: `/api/quotations/${id}/convert`,
      cookies,
      payload: { payments: [{ method: "CASH", amount: 3000 }] },
    });
    expect(convert.statusCode).toBe(201);
    expect(convert.json().total).toBe(3000);

    const again = await app.inject({
      method: "POST",
      url: `/api/quotations/${id}/convert`,
      cookies,
      payload: { payments: [{ method: "CASH", amount: 3000 }] },
    });
    await app.close();
    expect(again.statusCode).toBe(400);
    expect(again.json().code).toBe("ALREADY_CONVERTED");
  });

  it("forbids a branch-scoped user creating a quotation for another branch", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      permissions: ["quotations.manage"],
      isBranchScoped: true,
      branchId: f.branchId,
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/quotations",
      cookies: await sessionCookie(userId),
      payload: { branchId: f.otherBranchId, items: [{ productId: f.productId, quantity: 1 }] },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("BRANCH_FORBIDDEN");
  });
});
