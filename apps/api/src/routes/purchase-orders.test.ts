import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

interface Fixture {
  branchId: number;
  supplierId: number;
  productId: number;
}

async function fixture(): Promise<Fixture> {
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const product = await prisma.product.create({
    data: { sku: "P", name: "สินค้า", categoryId: category.id, basePrice: 1000 },
  });
  const supplier = await prisma.supplier.create({ data: { name: "ผู้จำหน่าย" } });
  return { branchId: branch.id, supplierId: supplier.id, productId: product.id };
}

describe("purchase-orders routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a draft PO with po.manage", async () => {
    const f = await fixture();
    const userId = await createTestUser({ username: "u", permissions: ["po.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/purchase-orders",
      cookies: await sessionCookie(userId),
      payload: {
        supplierId: f.supplierId,
        branchId: f.branchId,
        items: [{ productId: f.productId, orderedQty: 10, unitCost: 500 }],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe("DRAFT");
    expect(body.subtotal).toBe(5000);
    expect(body.vatAmount).toBe(350);
    expect(body.totalAmount).toBe(5350);
    expect(body.code).toMatch(/^PO-\d{4}-\d{4}$/);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].lineTotal).toBe(5000);
  });

  it("rejects creating a PO without po.manage", async () => {
    const f = await fixture();
    const viewerId = await createTestUser({ username: "v", permissions: ["po.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/purchase-orders",
      cookies: await sessionCookie(viewerId),
      payload: {
        supplierId: f.supplierId,
        branchId: f.branchId,
        items: [{ productId: f.productId, orderedQty: 1, unitCost: 100 }],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("confirms, partial-receives, then fully receives a PO and bumps stock", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      permissions: ["po.manage", "po.receive", "po.view", "stock.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);

    const created = await app.inject({
      method: "POST",
      url: "/api/purchase-orders",
      cookies,
      payload: {
        supplierId: f.supplierId,
        branchId: f.branchId,
        items: [{ productId: f.productId, orderedQty: 10, unitCost: 200 }],
      },
    });
    expect(created.statusCode).toBe(201);
    const poId = created.json().id;
    const itemId = created.json().items[0].id;

    const confirmed = await app.inject({
      method: "POST",
      url: `/api/purchase-orders/${poId}/confirm`,
      cookies,
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().status).toBe("CONFIRMED");

    const partial = await app.inject({
      method: "POST",
      url: `/api/purchase-orders/${poId}/receive`,
      cookies,
      payload: { items: [{ itemId, qty: 4 }] },
    });
    expect(partial.statusCode).toBe(200);
    expect(partial.json().status).toBe("PARTIALLY_RECEIVED");

    const level1 = await prisma.stockLevel.findUnique({
      where: { productId_branchId: { productId: f.productId, branchId: f.branchId } },
    });
    expect(level1?.quantity).toBe(4);

    const full = await app.inject({
      method: "POST",
      url: `/api/purchase-orders/${poId}/receive`,
      cookies,
      payload: { items: [{ itemId, qty: 6 }] },
    });
    await app.close();
    expect(full.statusCode).toBe(200);
    expect(full.json().status).toBe("FULLY_RECEIVED");
    expect(full.json().receivedDate).not.toBeNull();

    const level2 = await prisma.stockLevel.findUnique({
      where: { productId_branchId: { productId: f.productId, branchId: f.branchId } },
    });
    expect(level2?.quantity).toBe(10);
  });

  it("rejects receive against a PO that is not confirmed (still DRAFT)", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      permissions: ["po.manage", "po.receive"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/purchase-orders",
      cookies,
      payload: {
        supplierId: f.supplierId,
        branchId: f.branchId,
        items: [{ productId: f.productId, orderedQty: 5, unitCost: 100 }],
      },
    });
    const poId = created.json().id;
    const itemId = created.json().items[0].id;

    const res = await app.inject({
      method: "POST",
      url: `/api/purchase-orders/${poId}/receive`,
      cookies,
      payload: { items: [{ itemId, qty: 1 }] },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_STATUS");
  });

  it("updates a draft PO's items and re-computes totals", async () => {
    const f = await fixture();
    const userId = await createTestUser({ username: "u", permissions: ["po.manage"] });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/purchase-orders",
      cookies,
      payload: {
        supplierId: f.supplierId,
        branchId: f.branchId,
        items: [{ productId: f.productId, orderedQty: 2, unitCost: 100 }],
      },
    });
    const poId = created.json().id;
    const patched = await app.inject({
      method: "PATCH",
      url: `/api/purchase-orders/${poId}`,
      cookies,
      payload: {
        supplierId: f.supplierId,
        branchId: f.branchId,
        items: [{ productId: f.productId, orderedQty: 5, unitCost: 100 }],
      },
    });
    await app.close();
    expect(patched.statusCode).toBe(200);
    expect(patched.json().subtotal).toBe(500);
    expect(patched.json().items).toHaveLength(1);
    expect(patched.json().items[0].orderedQty).toBe(5);
  });

  it("cancels a draft PO", async () => {
    const f = await fixture();
    const userId = await createTestUser({ username: "u", permissions: ["po.manage"] });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/purchase-orders",
      cookies,
      payload: {
        supplierId: f.supplierId,
        branchId: f.branchId,
        items: [{ productId: f.productId, orderedQty: 1, unitCost: 100 }],
      },
    });
    const poId = created.json().id;
    const cancelled = await app.inject({
      method: "POST",
      url: `/api/purchase-orders/${poId}/cancel`,
      cookies,
    });
    await app.close();
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().status).toBe("CANCELLED");
  });
});
