import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables } from "../test-helpers/auth.js";
import { applyStockMovement, transferStock, StockError } from "./service.js";

async function fixture(): Promise<{ productId: number; branchA: number; branchB: number }> {
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const product = await prisma.product.create({
    data: { sku: "SKU1", name: "สินค้า", categoryId: category.id, basePrice: 100 },
  });
  const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "A" } });
  const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "B" } });
  return { productId: product.id, branchA: branchA.id, branchB: branchB.id };
}

describe("applyStockMovement", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a stock level and a movement for a positive delta", async () => {
    const { productId, branchA } = await fixture();
    const qty = await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId, branchId: branchA, delta: 10, reason: "ADJUST" }),
    );
    expect(qty).toBe(10);
    const level = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId, branchId: branchA } },
    });
    expect(level.quantity).toBe(10);
    expect(await prisma.stockMovement.count()).toBe(1);
  });

  it("accumulates quantity across movements", async () => {
    const { productId, branchA } = await fixture();
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId, branchId: branchA, delta: 10, reason: "ADJUST" }),
    );
    const qty = await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId, branchId: branchA, delta: -4, reason: "ADJUST" }),
    );
    expect(qty).toBe(6);
    expect(await prisma.stockMovement.count()).toBe(2);
  });

  it("throws and writes nothing when a negative delta exceeds on-hand", async () => {
    const { productId, branchA } = await fixture();
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId, branchId: branchA, delta: 3, reason: "ADJUST" }),
    );
    await expect(
      prisma.$transaction((tx) =>
        applyStockMovement(tx, { productId, branchId: branchA, delta: -5, reason: "ADJUST" }),
      ),
    ).rejects.toBeInstanceOf(StockError);

    const level = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId, branchId: branchA } },
    });
    expect(level.quantity).toBe(3);
    expect(await prisma.stockMovement.count()).toBe(1);
  });
});

describe("transferStock", () => {
  beforeEach(resetAuthTables);

  it("moves quantity between branches with linked movements", async () => {
    const { productId, branchA, branchB } = await fixture();
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId, branchId: branchA, delta: 20, reason: "ADJUST" }),
    );

    const transfer = await transferStock({
      productId,
      fromBranchId: branchA,
      toBranchId: branchB,
      quantity: 8,
    });

    const a = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId, branchId: branchA } },
    });
    const b = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId, branchId: branchB } },
    });
    expect(a.quantity).toBe(12);
    expect(b.quantity).toBe(8);

    const movements = await prisma.stockMovement.findMany({ where: { transferId: transfer.id } });
    expect(movements).toHaveLength(2);
  });

  it("rolls back the whole transfer when the source lacks stock", async () => {
    const { productId, branchA, branchB } = await fixture();
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, { productId, branchId: branchA, delta: 5, reason: "ADJUST" }),
    );

    await expect(
      transferStock({ productId, fromBranchId: branchA, toBranchId: branchB, quantity: 9 }),
    ).rejects.toBeInstanceOf(StockError);

    expect(await prisma.transfer.count()).toBe(0);
    const a = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_branchId: { productId, branchId: branchA } },
    });
    expect(a.quantity).toBe(5);
    expect(await prisma.stockMovement.count()).toBe(1);
  });

  it("rejects a non-positive quantity or a same-branch transfer", async () => {
    const { productId, branchA, branchB } = await fixture();
    await expect(
      transferStock({ productId, fromBranchId: branchA, toBranchId: branchB, quantity: 0 }),
    ).rejects.toBeInstanceOf(StockError);
    await expect(
      transferStock({ productId, fromBranchId: branchA, toBranchId: branchA, quantity: 1 }),
    ).rejects.toBeInstanceOf(StockError);
  });
});
