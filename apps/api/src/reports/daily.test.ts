import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables, createTestUser } from "../test-helpers/auth.js";
import { applyStockMovement } from "../stock/service.js";
import { checkout } from "../sales/checkout.js";
import { buildDailyReport, runDailyReport } from "./daily.js";

async function fixtureWithSale(): Promise<void> {
  const cashierId = await createTestUser({ username: "c", permissions: ["sales.create"] });
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขาทดสอบ", code: "SH" } });
  const product = await prisma.product.create({
    data: { sku: "P", name: "สินค้า", categoryId: category.id, basePrice: 1000 },
  });
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId: product.id, branchId: branch.id, delta: 100, reason: "ADJUST" }),
  );
  await checkout({
    branchId: branch.id,
    cashierId,
    items: [{ productId: product.id, quantity: 2 }],
    payments: [{ method: "CASH", amount: 2000 }],
    maxDiscountPercent: null,
  });
}

describe("buildDailyReport", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("renders the day's branch sales totals", async () => {
    await fixtureWithSale();
    const report = await buildDailyReport(prisma, new Date());
    expect(report.text).toContain("สาขาทดสอบ");
    expect(report.text).toContain("2,000");
    expect(report.text).toContain("รวมทุกสาขา");
  });
});

describe("runDailyReport", () => {
  beforeEach(resetAuthTables);

  it("records one history row per channel, skipped when no credentials are set", async () => {
    await fixtureWithSale();
    const rows = await runDailyReport(prisma, new Date());
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.channel).sort()).toEqual(["EMAIL", "LINE"]);
    expect(rows.every((r) => r.status === "SKIPPED")).toBe(true);
    expect(await prisma.dailyReportHistory.count()).toBe(2);
  });
});
