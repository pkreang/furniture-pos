import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

interface Fixture {
  branchId: number;
  branchCode: string;
  customerId: number;
  productId: number;
}

async function fixture(): Promise<Fixture> {
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const product = await prisma.product.create({
    data: { sku: "P", name: "สินค้า", categoryId: category.id, basePrice: 1000 },
  });
  const customer = await prisma.customer.create({
    data: { name: "ลูกค้า", phone: "0800000000" },
  });
  return {
    branchId: branch.id,
    branchCode: branch.code,
    customerId: customer.id,
    productId: product.id,
  };
}

async function seedStock(productId: number, branchId: number, qty: number): Promise<void> {
  await prisma.stockLevel.upsert({
    where: { productId_branchId: { productId, branchId } },
    update: { quantity: qty },
    create: { productId, branchId, quantity: qty },
  });
}

describe("sales-orders routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a draft SO and computes totals", async () => {
    const f = await fixture();
    const userId = await createTestUser({ username: "u", permissions: ["so.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies: await sessionCookie(userId),
      payload: {
        customerId: f.customerId,
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 2, unitPrice: 500 }],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe("DRAFT");
    expect(body.subtotal).toBe(1000);
    expect(body.vatAmount).toBe(70);
    expect(body.totalAmount).toBe(1070);
    expect(body.code).toMatch(/^SO-\d{4}-\d{4}$/);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].lineTotal).toBe(1000);
  });

  it("rejects creating an SO without so.manage", async () => {
    const f = await fixture();
    const viewerId = await createTestUser({ username: "v", permissions: ["so.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies: await sessionCookie(viewerId),
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 1, unitPrice: 100 }],
      },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("confirms a draft SO and reserves stock", async () => {
    const f = await fixture();
    await seedStock(f.productId, f.branchId, 10);
    const userId = await createTestUser({
      username: "u",
      permissions: ["so.manage", "so.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);

    const created = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 3, unitPrice: 200 }],
      },
    });
    const soId = created.json().id;

    const confirmed = await app.inject({
      method: "POST",
      url: `/api/sales-orders/${soId}/confirm`,
      cookies,
    });
    await app.close();
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().status).toBe("CONFIRMED");

    const level = await prisma.stockLevel.findUnique({
      where: { productId_branchId: { productId: f.productId, branchId: f.branchId } },
    });
    expect(level?.quantity).toBe(10);
    expect(level?.reservedQty).toBe(3);
  });

  it("rejects confirming with insufficient stock", async () => {
    const f = await fixture();
    await seedStock(f.productId, f.branchId, 2);
    const userId = await createTestUser({
      username: "u",
      permissions: ["so.manage"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 5, unitPrice: 200 }],
      },
    });
    const soId = created.json().id;
    const confirmed = await app.inject({
      method: "POST",
      url: `/api/sales-orders/${soId}/confirm`,
      cookies,
    });
    await app.close();
    expect(confirmed.statusCode).toBe(400);
    expect(confirmed.json().code).toBe("INSUFFICIENT_STOCK");
  });

  it("delivers a confirmed SO: drains reservedQty and decrements quantity", async () => {
    const f = await fixture();
    await seedStock(f.productId, f.branchId, 10);
    const userId = await createTestUser({
      username: "u",
      permissions: ["so.manage", "so.fulfill"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);

    const created = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 4, unitPrice: 100 }],
      },
    });
    const soId = created.json().id;
    await app.inject({
      method: "POST",
      url: `/api/sales-orders/${soId}/confirm`,
      cookies,
    });
    const delivered = await app.inject({
      method: "POST",
      url: `/api/sales-orders/${soId}/deliver`,
      cookies,
    });
    await app.close();
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json().status).toBe("DELIVERED");
    expect(delivered.json().deliveredDate).not.toBeNull();

    const level = await prisma.stockLevel.findUnique({
      where: { productId_branchId: { productId: f.productId, branchId: f.branchId } },
    });
    expect(level?.quantity).toBe(6);
    expect(level?.reservedQty).toBe(0);
  });

  it("cancels a confirmed SO and releases the reservation", async () => {
    const f = await fixture();
    await seedStock(f.productId, f.branchId, 5);
    const userId = await createTestUser({
      username: "u",
      permissions: ["so.manage"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 2, unitPrice: 100 }],
      },
    });
    const soId = created.json().id;
    await app.inject({
      method: "POST",
      url: `/api/sales-orders/${soId}/confirm`,
      cookies,
    });
    const cancelled = await app.inject({
      method: "POST",
      url: `/api/sales-orders/${soId}/cancel`,
      cookies,
    });
    await app.close();
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().status).toBe("CANCELLED");

    const level = await prisma.stockLevel.findUnique({
      where: { productId_branchId: { productId: f.productId, branchId: f.branchId } },
    });
    expect(level?.quantity).toBe(5);
    expect(level?.reservedQty).toBe(0);
  });

  it("rejects delivering a draft SO with INVALID_STATUS", async () => {
    const f = await fixture();
    await seedStock(f.productId, f.branchId, 5);
    const userId = await createTestUser({
      username: "u",
      permissions: ["so.manage", "so.fulfill"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 1, unitPrice: 100 }],
      },
    });
    const soId = created.json().id;
    const delivered = await app.inject({
      method: "POST",
      url: `/api/sales-orders/${soId}/deliver`,
      cookies,
    });
    await app.close();
    expect(delivered.statusCode).toBe(400);
    expect(delivered.json().code).toBe("INVALID_STATUS");
  });

  it("blocks POS oversell when stock is reserved by an SO", async () => {
    const f = await fixture();
    await seedStock(f.productId, f.branchId, 5);
    // Confirm an SO that reserves 4 of the 5 in stock.
    const managerId = await createTestUser({
      username: "mgr",
      permissions: ["so.manage"],
    });
    const app = buildApp();
    const mgrCookies = await sessionCookie(managerId);
    const soRes = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies: mgrCookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 4, unitPrice: 100 }],
      },
    });
    await app.inject({
      method: "POST",
      url: `/api/sales-orders/${soRes.json().id}/confirm`,
      cookies: mgrCookies,
    });

    // Now try to ring up a POS sale of 2: only 1 is actually available.
    const cashierId = await createTestUser({
      username: "csh",
      roleKey: "csh-role",
      permissions: ["sales.create"],
    });
    const cshCookies = await sessionCookie(cashierId);
    const checkoutRes = await app.inject({
      method: "POST",
      url: "/api/sales",
      cookies: cshCookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 2 }],
        payments: [{ method: "CASH", amount: 2000 }],
      },
    });
    await app.close();
    expect(checkoutRes.statusCode).toBe(400);
    expect(checkoutRes.json().code).toBe("INSUFFICIENT_STOCK");
  });

  it("converts a quotation into a draft SO", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      permissions: ["so.manage", "quotations.manage"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const quoteRes = await app.inject({
      method: "POST",
      url: "/api/quotations",
      cookies,
      payload: {
        branchId: f.branchId,
        customerId: f.customerId,
        items: [{ productId: f.productId, quantity: 2 }],
      },
    });
    expect(quoteRes.statusCode).toBe(201);
    const qid = quoteRes.json().id;
    const convertRes = await app.inject({
      method: "POST",
      url: `/api/quotations/${qid}/convert-to-so`,
      cookies,
      payload: {},
    });
    await app.close();
    expect(convertRes.statusCode).toBe(201);
    const so = convertRes.json();
    expect(so.status).toBe("DRAFT");
    expect(so.quotationId).toBe(qid);
    expect(so.items).toHaveLength(1);
    expect(so.items[0].quantity).toBe(2);
  });

  it("defaults salesperson to the creator when none is supplied", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "creator",
      permissions: ["so.manage", "so.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const create = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies,
      payload: {
        branchId: f.branchId,
        items: [{ productId: f.productId, quantity: 1, unitPrice: 100 }],
      },
    });
    expect(create.statusCode).toBe(201);

    const read = await app.inject({
      method: "GET",
      url: `/api/sales-orders/${create.json().id}`,
      cookies,
    });
    await app.close();
    expect(read.statusCode).toBe(200);
    const body = read.json();
    expect(body.salespersonId).toBe(userId);
    expect(body.salesperson?.id).toBe(userId);
    expect(body.createdBy?.id).toBe(userId);
  });

  it("records a salesperson override distinct from the creator", async () => {
    const f = await fixture();
    const creatorId = await createTestUser({
      username: "creator",
      permissions: ["so.manage", "so.view"],
    });
    const otherSalespersonId = await createTestUser({
      username: "other-sales",
      roleKey: "other-sales-role",
      permissions: [],
    });
    const app = buildApp();
    const cookies = await sessionCookie(creatorId);
    const create = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      cookies,
      payload: {
        branchId: f.branchId,
        salespersonId: otherSalespersonId,
        items: [{ productId: f.productId, quantity: 1, unitPrice: 100 }],
      },
    });
    expect(create.statusCode).toBe(201);
    const read = await app.inject({
      method: "GET",
      url: `/api/sales-orders/${create.json().id}`,
      cookies,
    });
    await app.close();
    const body = read.json();
    expect(body.salespersonId).toBe(otherSalespersonId);
    expect(body.salesperson?.id).toBe(otherSalespersonId);
    expect(body.createdBy?.id).toBe(creatorId);
  });
});
