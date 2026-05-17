import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables, createTestUser } from "../test-helpers/auth.js";
import { applyStockMovement } from "../stock/service.js";
import { checkout } from "../sales/checkout.js";
import { voidSale } from "../sales/void.js";
import { generateZReport, ZReportError } from "./zreport.js";

interface Fixture {
  userId: number;
  branchId: number;
  productId: number;
}

async function fixture(): Promise<Fixture> {
  const userId = await createTestUser({ username: "u", permissions: ["reports.generate"] });
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const product = await prisma.product.create({
    data: { sku: "P", name: "สินค้า", categoryId: category.id, basePrice: 1000 },
  });
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId: product.id, branchId: branch.id, delta: 100, reason: "ADJUST" }),
  );
  return { userId, branchId: branch.id, productId: product.id };
}

function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

describe("generateZReport", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("aggregates the day's completed sales and the payment breakdown", async () => {
    const f = await fixture();
    await checkout({
      branchId: f.branchId,
      cashierId: f.userId,
      items: [{ productId: f.productId, quantity: 2 }],
      payments: [{ method: "CASH", amount: 2000 }],
      maxDiscountPercent: null,
    });
    await checkout({
      branchId: f.branchId,
      cashierId: f.userId,
      items: [{ productId: f.productId, quantity: 1 }],
      payments: [{ method: "CARD", amount: 1000 }],
      maxDiscountPercent: null,
    });

    const z = await generateZReport(prisma, {
      branchId: f.branchId,
      businessDate: today(),
      generatedById: f.userId,
    });
    expect(z.salesCount).toBe(2);
    expect(z.grossTotal).toBe(3000);
    expect(z.cashTotal).toBe(2000);
    expect(z.cardTotal).toBe(1000);
    expect(z.transferTotal).toBe(0);
    expect(z.vatTotal).toBeGreaterThan(0);
  });

  it("counts voided sales separately from the gross total", async () => {
    const f = await fixture();
    const sale = await checkout({
      branchId: f.branchId,
      cashierId: f.userId,
      items: [{ productId: f.productId, quantity: 1 }],
      payments: [{ method: "CASH", amount: 1000 }],
      maxDiscountPercent: null,
    });
    await voidSale(sale.id, f.userId);

    const z = await generateZReport(prisma, {
      branchId: f.branchId,
      businessDate: today(),
      generatedById: f.userId,
    });
    expect(z.salesCount).toBe(0);
    expect(z.grossTotal).toBe(0);
    expect(z.voidedCount).toBe(1);
    expect(z.voidedTotal).toBe(1000);
  });

  it("rejects generating a second Z-report for the same branch and date", async () => {
    const f = await fixture();
    await generateZReport(prisma, {
      branchId: f.branchId,
      businessDate: today(),
      generatedById: f.userId,
    });
    await expect(
      generateZReport(prisma, {
        branchId: f.branchId,
        businessDate: today(),
        generatedById: f.userId,
      }),
    ).rejects.toMatchObject({ code: "ALREADY_EXISTS" });
  });

  it("exposes ZReportError with a code", () => {
    expect(new ZReportError("ALREADY_EXISTS", "x").code).toBe("ALREADY_EXISTS");
  });
});
