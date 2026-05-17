import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables, createTestUser } from "../test-helpers/auth.js";
import { applyStockMovement } from "../stock/service.js";
import { applyPointTransaction } from "../membership/points.js";
import { checkout } from "./checkout.js";
import { voidSale, VoidError } from "./void.js";

interface Fixture {
  cashierId: number;
  branchId: number;
  productA: number;
}

async function fixture(): Promise<Fixture> {
  const cashierId = await createTestUser({ username: "cashier", permissions: ["sales.create"] });
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const a = await prisma.product.create({
    data: { sku: "A", name: "สินค้า A", categoryId: category.id, basePrice: 1000 },
  });
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId: a.id, branchId: branch.id, delta: 100, reason: "ADJUST" }),
  );
  return { cashierId, branchId: branch.id, productA: a.id };
}

describe("voidSale", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("flips the sale to VOIDED and records who/why/when", async () => {
    const f = await fixture();
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productA, quantity: 2 }],
      payments: [{ method: "CASH", amount: 2000 }],
      maxDiscountPercent: null,
    });

    const voided = await voidSale(sale.id, f.cashierId, "ลูกค้าคืนของ");
    expect(voided.status).toBe("VOIDED");
    expect(voided.voidedById).toBe(f.cashierId);
    expect(voided.voidReason).toBe("ลูกค้าคืนของ");
    expect(voided.voidedAt).not.toBeNull();
  });

  it("returns every sold unit to stock", async () => {
    const f = await fixture();
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productA, quantity: 7 }],
      payments: [{ method: "CASH", amount: 7000 }],
      maxDiscountPercent: null,
    });
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId: f.productA, branchId: f.branchId } },
    });
    expect(before.quantity).toBe(93);

    await voidSale(sale.id, f.cashierId);

    const after = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId: f.productA, branchId: f.branchId } },
    });
    expect(after.quantity).toBe(100);
    const refundMoves = await prisma.stockMovement.count({
      where: { saleId: sale.id, reason: "REFUND" },
    });
    expect(refundMoves).toBe(1);
  });

  it("reverses points and lifetime spend for a member", async () => {
    const f = await fixture();
    const customer = await prisma.customer.create({ data: { name: "สมาชิก", phone: "0810000000" } });
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      customerId: customer.id,
      items: [{ productId: f.productA, quantity: 5 }],
      payments: [{ method: "CASH", amount: 5000 }],
      maxDiscountPercent: null,
    });
    const earned = sale.pointsEarned; // 50
    const mid = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(mid.pointsBalance).toBe(earned);
    expect(mid.lifetimeSpend).toBe(5000);

    await voidSale(sale.id, f.cashierId);

    const after = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after.pointsBalance).toBe(0);
    expect(after.lifetimeSpend).toBe(0);
  });

  it("clamps the earned-points clawback so the balance never goes negative", async () => {
    const f = await fixture();
    const customer = await prisma.customer.create({ data: { name: "ใช้แต้มหมด", phone: "0820000000" } });
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      customerId: customer.id,
      items: [{ productId: f.productA, quantity: 5 }],
      payments: [{ method: "CASH", amount: 5000 }],
      maxDiscountPercent: null,
    });
    // spend all earned points elsewhere before the void
    await prisma.$transaction((tx) =>
      applyPointTransaction(tx, {
        customerId: customer.id,
        delta: -sale.pointsEarned,
        reason: "ADJUST",
      }),
    );

    await voidSale(sale.id, f.cashierId);

    const after = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after.pointsBalance).toBe(0);
  });

  it("rejects voiding an already-voided sale and an unknown id", async () => {
    const f = await fixture();
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 1000 }],
      maxDiscountPercent: null,
    });
    await voidSale(sale.id, f.cashierId);

    await expect(voidSale(sale.id, f.cashierId)).rejects.toMatchObject({ code: "ALREADY_VOIDED" });
    await expect(voidSale(999999, f.cashierId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("exposes VoidError with a code", () => {
    expect(new VoidError("NOT_FOUND", "x").code).toBe("NOT_FOUND");
  });
});
