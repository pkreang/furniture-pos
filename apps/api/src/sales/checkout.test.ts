import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables, createTestUser } from "../test-helpers/auth.js";
import { applyStockMovement } from "../stock/service.js";
import { applyPointTransaction } from "../membership/points.js";
import { checkout, CheckoutError } from "./checkout.js";

interface Fixture {
  cashierId: number;
  branchId: number;
  branchCode: string;
  warehouseId: number;
  productA: number;
  productB: number;
}

async function fixture(): Promise<Fixture> {
  const cashierId = await createTestUser({ username: "cashier", permissions: ["sales.create"] });
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const warehouse = await prisma.branch.create({
    data: { name: "คลัง", code: "WH", isWarehouse: true },
  });
  const a = await prisma.product.create({
    data: { sku: "A", name: "สินค้า A", categoryId: category.id, basePrice: 1000 },
  });
  const b = await prisma.product.create({
    data: { sku: "B", name: "สินค้า B", categoryId: category.id, basePrice: 500 },
  });
  for (const productId of [a.id, b.id]) {
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId, branchId: branch.id, delta: 100, reason: "ADJUST" }),
    );
  }
  return {
    cashierId,
    branchId: branch.id,
    branchCode: branch.code,
    warehouseId: warehouse.id,
    productA: a.id,
    productB: b.id,
  };
}

describe("checkout", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rings up a sale, snapshots items, splits VAT, and decrements stock", async () => {
    const f = await fixture();
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [
        { productId: f.productA, quantity: 2 },
        { productId: f.productB, quantity: 1 },
      ],
      payments: [{ method: "CASH", amount: 2500 }],
      maxDiscountPercent: null,
    });

    expect(sale.number).toBe("SH-000001");
    expect(sale.subtotal).toBe(2500);
    expect(sale.total).toBe(2500);
    expect(sale.taxBase + sale.vatAmount).toBe(2500);
    expect(sale.items).toHaveLength(2);
    expect(sale.items[0].productName).toBe("สินค้า A");
    expect(sale.taxInvoice?.type).toBe("ABBREVIATED");

    const level = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId: f.productA, branchId: f.branchId } },
    });
    expect(level.quantity).toBe(98);
  });

  it("numbers sales per branch", async () => {
    const f = await fixture();
    const order = {
      cashierId: f.cashierId,
      items: [{ productId: f.productA, quantity: 1 }],
      payments: [{ method: "CASH" as const, amount: 1000 }],
      maxDiscountPercent: null,
    };
    const first = await checkout({ ...order, branchId: f.branchId });
    const second = await checkout({ ...order, branchId: f.branchId });
    expect(first.number).toBe("SH-000001");
    expect(second.number).toBe("SH-000002");

    const other = await prisma.branch.create({ data: { name: "อีกสาขา", code: "SH2" } });
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId: f.productA, branchId: other.id, delta: 10, reason: "ADJUST" }),
    );
    const otherSale = await checkout({ ...order, branchId: other.id });
    expect(otherSale.number).toBe("SH2-000001");
  });

  it("rolls back fully and does not consume a number on insufficient stock", async () => {
    const f = await fixture();
    await expect(
      checkout({
        branchId: f.branchId,
        cashierId: f.cashierId,
        items: [{ productId: f.productA, quantity: 9999 }],
        payments: [{ method: "CASH", amount: 9999000 }],
        maxDiscountPercent: null,
      }),
    ).rejects.toThrow();

    expect(await prisma.sale.count()).toBe(0);
    const level = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId: f.productA, branchId: f.branchId } },
    });
    expect(level.quantity).toBe(100);

    const ok = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 1000 }],
      maxDiscountPercent: null,
    });
    expect(ok.number).toBe("SH-000001");
  });

  it("applies a discount within the cap and rejects one above it", async () => {
    const f = await fixture();
    const discounted = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 900 }],
      discountPercent: 10,
      maxDiscountPercent: 10,
    });
    expect(discounted.discountAmount).toBe(100);
    expect(discounted.total).toBe(900);

    await expect(
      checkout({
        branchId: f.branchId,
        cashierId: f.cashierId,
        items: [{ productId: f.productA, quantity: 1 }],
        payments: [{ method: "CASH", amount: 800 }],
        discountPercent: 20,
        maxDiscountPercent: 10,
      }),
    ).rejects.toMatchObject({ code: "DISCOUNT_TOO_HIGH" });
  });

  it("rejects a payment above the sale total and a zero payment", async () => {
    const f = await fixture();
    await expect(
      checkout({
        branchId: f.branchId,
        cashierId: f.cashierId,
        items: [{ productId: f.productA, quantity: 1 }],
        payments: [{ method: "CASH", amount: 1500 }],
        maxDiscountPercent: null,
      }),
    ).rejects.toMatchObject({ code: "OVERPAYMENT" });

    await expect(
      checkout({
        branchId: f.branchId,
        cashierId: f.cashierId,
        items: [{ productId: f.productA, quantity: 1 }],
        payments: [{ method: "CASH", amount: 0 }],
        maxDiscountPercent: null,
      }),
    ).rejects.toMatchObject({ code: "NO_PAYMENT" });
  });

  it("accepts a partial payment and records the outstanding balance", async () => {
    const f = await fixture();
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 400 }],
      maxDiscountPercent: null,
    });
    expect(sale.total).toBe(1000);
    expect(sale.outstanding).toBe(600);
  });

  it("leaves a fully paid sale with zero outstanding", async () => {
    const f = await fixture();
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      items: [{ productId: f.productA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 1000 }],
      maxDiscountPercent: null,
    });
    expect(sale.outstanding).toBe(0);
  });

  it("rejects selling from a warehouse branch and an empty cart", async () => {
    const f = await fixture();
    await expect(
      checkout({
        branchId: f.warehouseId,
        cashierId: f.cashierId,
        items: [{ productId: f.productA, quantity: 1 }],
        payments: [{ method: "CASH", amount: 1000 }],
        maxDiscountPercent: null,
      }),
    ).rejects.toMatchObject({ code: "WAREHOUSE_NO_SALE" });

    await expect(
      checkout({
        branchId: f.branchId,
        cashierId: f.cashierId,
        items: [],
        payments: [],
        maxDiscountPercent: null,
      }),
    ).rejects.toMatchObject({ code: "EMPTY_CART" });
  });

  it("earns points and raises lifetime spend for a member", async () => {
    const f = await fixture();
    const customer = await prisma.customer.create({ data: { name: "สมาชิก", phone: "0810000000" } });
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      customerId: customer.id,
      items: [{ productId: f.productA, quantity: 3 }],
      payments: [{ method: "CASH", amount: 3000 }],
      maxDiscountPercent: null,
    });
    expect(sale.pointsEarned).toBe(30);

    const after = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after.pointsBalance).toBe(30);
    expect(after.lifetimeSpend).toBe(3000);
  });

  it("redeems points as a discount and rejects redeeming more than the balance", async () => {
    const f = await fixture();
    const customer = await prisma.customer.create({ data: { name: "ใช้แต้ม", phone: "0820000000" } });
    await prisma.$transaction((tx) =>
      applyPointTransaction(tx, { customerId: customer.id, delta: 200, reason: "ADJUST" }),
    );

    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      customerId: customer.id,
      items: [{ productId: f.productA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 800 }],
      redeemPoints: 200,
      maxDiscountPercent: null,
    });
    expect(sale.total).toBe(800);
    expect(sale.pointsRedeemed).toBe(200);

    const after = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    // started 200, redeemed 200, earned calcPointsEarned(800) = 8
    expect(after.pointsBalance).toBe(8);

    await expect(
      checkout({
        branchId: f.branchId,
        cashierId: f.cashierId,
        customerId: customer.id,
        items: [{ productId: f.productA, quantity: 1 }],
        payments: [{ method: "CASH", amount: 950 }],
        redeemPoints: 50,
        maxDiscountPercent: null,
      }),
    ).rejects.toThrow();
  });

  it("issues a full tax invoice for a customer with tax data", async () => {
    const f = await fixture();
    const customer = await prisma.customer.create({
      data: {
        name: "บริษัท",
        phone: "0830000000",
        taxId: "0105500000001",
        taxName: "บริษัท จำกัด",
        taxAddress: "กรุงเทพฯ",
      },
    });
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.cashierId,
      customerId: customer.id,
      items: [{ productId: f.productA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 1000 }],
      maxDiscountPercent: null,
    });
    expect(sale.taxInvoice?.type).toBe("FULL");
    expect(sale.taxInvoice?.customerTaxId).toBe("0105500000001");
  });

  it("exposes CheckoutError with a code", async () => {
    const err = new CheckoutError("EMPTY_CART", "x");
    expect(err.code).toBe("EMPTY_CART");
  });
});
