import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables } from "../test-helpers/auth.js";
import { nextNumber, formatSaleNumber } from "./numbering.js";

describe("nextNumber", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 1, then 2 on successive calls for the same branch", async () => {
    const branch = await prisma.branch.create({ data: { name: "สาขา", code: "N1" } });
    const first = await prisma.$transaction((tx) => nextNumber(tx, branch.id, "sale"));
    const second = await prisma.$transaction((tx) => nextNumber(tx, branch.id, "sale"));
    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it("keeps sequences independent across branches", async () => {
    const a = await prisma.branch.create({ data: { name: "A", code: "NA" } });
    const b = await prisma.branch.create({ data: { name: "B", code: "NB" } });
    await prisma.$transaction((tx) => nextNumber(tx, a.id, "sale"));
    await prisma.$transaction((tx) => nextNumber(tx, a.id, "sale"));
    const bFirst = await prisma.$transaction((tx) => nextNumber(tx, b.id, "sale"));
    expect(bFirst).toBe(1);
  });
});

describe("formatSaleNumber", () => {
  it("zero-pads to six digits with the branch code", () => {
    expect(formatSaleNumber("BKK01", 1)).toBe("BKK01-000001");
    expect(formatSaleNumber("BKK01", 123456)).toBe("BKK01-123456");
  });
});
