import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables, createTestUser } from "../test-helpers/auth.js";
import { applyStockMovement } from "../stock/service.js";
import { createQuotation, convertQuotation, QuotationError } from "./quotation.js";

interface Fixture {
  userId: number;
  branchId: number;
  branchCode: string;
  productA: number;
}

async function fixture(): Promise<Fixture> {
  const userId = await createTestUser({ username: "u", permissions: ["quotations.manage"] });
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const a = await prisma.product.create({
    data: { sku: "A", name: "สินค้า A", categoryId: category.id, basePrice: 1000 },
  });
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId: a.id, branchId: branch.id, delta: 100, reason: "ADJUST" }),
  );
  return { userId, branchId: branch.id, branchCode: branch.code, productA: a.id };
}

describe("createQuotation", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("snapshots line prices and a subtotal without touching stock", async () => {
    const f = await fixture();
    const quote = await createQuotation({
      branchId: f.branchId,
      createdById: f.userId,
      items: [{ productId: f.productA, quantity: 3 }],
    });

    expect(quote.number).toBe("SH-Q000001");
    expect(quote.subtotal).toBe(3000);
    expect(quote.items[0].unitPrice).toBe(1000);
    expect(quote.status).toBe("OPEN");

    const level = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId: f.productA, branchId: f.branchId } },
    });
    expect(level.quantity).toBe(100);
  });
});

describe("convertQuotation", () => {
  beforeEach(resetAuthTables);

  it("produces a sale, decrements stock, and marks the quotation CONVERTED", async () => {
    const f = await fixture();
    const quote = await createQuotation({
      branchId: f.branchId,
      createdById: f.userId,
      items: [{ productId: f.productA, quantity: 2 }],
    });

    const sale = await convertQuotation({
      quotationId: quote.id,
      cashierId: f.userId,
      payments: [{ method: "CASH", amount: 2000 }],
      maxDiscountPercent: null,
    });
    expect(sale.total).toBe(2000);

    const level = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId: f.productA, branchId: f.branchId } },
    });
    expect(level.quantity).toBe(98);

    const after = await prisma.quotation.findUniqueOrThrow({ where: { id: quote.id } });
    expect(after.status).toBe("CONVERTED");
    expect(after.convertedSaleId).toBe(sale.id);
  });

  it("rejects converting an already-converted quotation", async () => {
    const f = await fixture();
    const quote = await createQuotation({
      branchId: f.branchId,
      createdById: f.userId,
      items: [{ productId: f.productA, quantity: 1 }],
    });
    await convertQuotation({
      quotationId: quote.id,
      cashierId: f.userId,
      payments: [{ method: "CASH", amount: 1000 }],
      maxDiscountPercent: null,
    });

    await expect(
      convertQuotation({
        quotationId: quote.id,
        cashierId: f.userId,
        payments: [{ method: "CASH", amount: 1000 }],
        maxDiscountPercent: null,
      }),
    ).rejects.toMatchObject({ code: "ALREADY_CONVERTED" });
  });

  it("exposes QuotationError with a code", () => {
    expect(new QuotationError("NOT_FOUND", "x").code).toBe("NOT_FOUND");
  });
});
