import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { checkout } from "../sales/checkout.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

interface Fixture {
  branchId: number;
  otherBranchId: number;
  saleId: number;
  otherSaleId: number;
  zoneId: number;
  channelId: number;
}

async function fixture(): Promise<Fixture> {
  const cashierId = await createTestUser({ username: "c", permissions: ["sales.create"] });
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const other = await prisma.branch.create({ data: { name: "อีก", code: "SH2" } });
  const product = await prisma.product.create({
    data: { sku: "P", name: "สินค้า", categoryId: category.id, basePrice: 1000 },
  });
  for (const branchId of [branch.id, other.id]) {
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId: product.id, branchId, delta: 50, reason: "ADJUST" }),
    );
  }
  const order = {
    cashierId,
    items: [{ productId: product.id, quantity: 1 }],
    payments: [{ method: "CASH" as const, amount: 1000 }],
    maxDiscountPercent: null,
  };
  const sale = await checkout({ ...order, branchId: branch.id });
  const otherSale = await checkout({ ...order, branchId: other.id });
  const zone = await prisma.deliveryZone.create({ data: { name: "โซน", fee: 200 } });
  const channel = await prisma.deliveryChannel.create({ data: { name: "ช่อง", type: "COURIER" } });
  return {
    branchId: branch.id,
    otherBranchId: other.id,
    saleId: sale.id,
    otherSaleId: otherSale.id,
    zoneId: zone.id,
    channelId: channel.id,
  };
}

function payload(f: Fixture, saleId: number): Record<string, unknown> {
  return {
    saleId,
    zoneId: f.zoneId,
    channelId: f.channelId,
    scheduledDate: "2026-06-01T00:00:00.000Z",
    addressText: "123 ถนน",
  };
}

describe("delivery routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("books a delivery with delivery.manage", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      roleKey: "mgr",
      permissions: ["delivery.manage", "delivery.view"],
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deliveries",
      cookies: await sessionCookie(userId),
      payload: payload(f, f.saleId),
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe("PENDING");
    expect(res.json().fee).toBe(200);
  });

  it("forbids a branch-scoped user booking another branch's sale", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      roleKey: "mgr",
      permissions: ["delivery.manage"],
      isBranchScoped: true,
      branchId: f.branchId,
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deliveries",
      cookies: await sessionCookie(userId),
      payload: payload(f, f.otherSaleId),
    });
    await app.close();
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("BRANCH_FORBIDDEN");
  });

  it("lists deliveries and filters by status", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      roleKey: "mgr",
      permissions: ["delivery.manage", "delivery.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    await app.inject({ method: "POST", url: "/api/deliveries", cookies, payload: payload(f, f.saleId) });

    const all = await app.inject({ method: "GET", url: "/api/deliveries", cookies });
    expect(all.json()).toHaveLength(1);

    const delivered = await app.inject({
      method: "GET",
      url: "/api/deliveries?status=DELIVERED",
      cookies,
    });
    await app.close();
    expect(delivered.json()).toHaveLength(0);
  });

  it("advances a delivery status and rejects an illegal transition", async () => {
    const f = await fixture();
    const userId = await createTestUser({
      username: "u",
      roleKey: "mgr",
      permissions: ["delivery.manage", "delivery.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(userId);
    const created = await app.inject({
      method: "POST",
      url: "/api/deliveries",
      cookies,
      payload: payload(f, f.saleId),
    });
    const id = created.json().id;

    const ok = await app.inject({
      method: "PATCH",
      url: `/api/deliveries/${id}/status`,
      cookies,
      payload: { status: "SCHEDULED" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().status).toBe("SCHEDULED");

    const bad = await app.inject({
      method: "PATCH",
      url: `/api/deliveries/${id}/status`,
      cookies,
      payload: { status: "DELIVERED" },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().code).toBe("INVALID_TRANSITION");

    const detail = await app.inject({ method: "GET", url: `/api/deliveries/${id}`, cookies });
    await app.close();
    expect(detail.json().history).toHaveLength(2);
  });
});
