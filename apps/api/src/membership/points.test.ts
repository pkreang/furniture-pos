import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables } from "../test-helpers/auth.js";
import { applyPointTransaction, PointError } from "./points.js";

async function makeCustomer(): Promise<number> {
  const c = await prisma.customer.create({ data: { name: "ลูกค้า", phone: "0810000000" } });
  return c.id;
}

describe("applyPointTransaction", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("raises the balance and writes a ledger row for a positive delta", async () => {
    const customerId = await makeCustomer();
    const balance = await prisma.$transaction((tx) =>
      applyPointTransaction(tx, { customerId, delta: 120, reason: "ADJUST" }),
    );
    expect(balance).toBe(120);
    expect(await prisma.pointTransaction.count()).toBe(1);
  });

  it("lowers the balance for a negative delta within balance", async () => {
    const customerId = await makeCustomer();
    await prisma.$transaction((tx) =>
      applyPointTransaction(tx, { customerId, delta: 50, reason: "ADJUST" }),
    );
    const balance = await prisma.$transaction((tx) =>
      applyPointTransaction(tx, { customerId, delta: -20, reason: "ADJUST" }),
    );
    expect(balance).toBe(30);
    expect(await prisma.pointTransaction.count()).toBe(2);
  });

  it("throws and writes nothing when a negative delta exceeds the balance", async () => {
    const customerId = await makeCustomer();
    await prisma.$transaction((tx) =>
      applyPointTransaction(tx, { customerId, delta: 10, reason: "ADJUST" }),
    );
    await expect(
      prisma.$transaction((tx) =>
        applyPointTransaction(tx, { customerId, delta: -40, reason: "ADJUST" }),
      ),
    ).rejects.toBeInstanceOf(PointError);

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(customer.pointsBalance).toBe(10);
    expect(await prisma.pointTransaction.count()).toBe(1);
  });

  it("throws for an unknown customer", async () => {
    await expect(
      prisma.$transaction((tx) =>
        applyPointTransaction(tx, { customerId: 999999, delta: 10, reason: "ADJUST" }),
      ),
    ).rejects.toBeInstanceOf(PointError);
  });
});
