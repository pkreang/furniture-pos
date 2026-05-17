import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables, createTestUser } from "../test-helpers/auth.js";
import { applyStockMovement } from "../stock/service.js";
import { checkout } from "../sales/checkout.js";
import { voidSale } from "../sales/void.js";
import { createDelivery, changeDeliveryStatus, DeliveryError } from "./service.js";

interface Fixture {
  userId: number;
  saleId: number;
  zoneId: number;
  channelId: number;
}

async function fixture(): Promise<Fixture> {
  const userId = await createTestUser({ username: "u", permissions: ["delivery.manage"] });
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
  const product = await prisma.product.create({
    data: { sku: "P", name: "สินค้า", categoryId: category.id, basePrice: 1000 },
  });
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, { productId: product.id, branchId: branch.id, delta: 50, reason: "ADJUST" }),
  );
  const sale = await checkout({
    branchId: branch.id,
    cashierId: userId,
    items: [{ productId: product.id, quantity: 1 }],
    payments: [{ method: "CASH", amount: 1000 }],
    maxDiscountPercent: null,
  });
  const zone = await prisma.deliveryZone.create({ data: { name: "โซน", fee: 300 } });
  const channel = await prisma.deliveryChannel.create({ data: { name: "ช่อง", type: "COURIER" } });
  return { userId, saleId: sale.id, zoneId: zone.id, channelId: channel.id };
}

function bookArgs(f: Fixture): Parameters<typeof createDelivery>[0] {
  return {
    saleId: f.saleId,
    zoneId: f.zoneId,
    channelId: f.channelId,
    scheduledDate: new Date("2026-06-01"),
    addressText: "123 ถนนทดสอบ",
  };
}

describe("createDelivery", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("books a PENDING delivery, snapshots the zone fee, and writes an initial history row", async () => {
    const f = await fixture();
    const delivery = await createDelivery(bookArgs(f));
    expect(delivery.status).toBe("PENDING");
    expect(delivery.fee).toBe(300);
    expect(delivery.history).toHaveLength(1);
    expect(delivery.history[0].status).toBe("PENDING");
  });

  it("rejects a second delivery for the same sale", async () => {
    const f = await fixture();
    await createDelivery(bookArgs(f));
    await expect(createDelivery(bookArgs(f))).rejects.toMatchObject({ code: "ALREADY_EXISTS" });
  });

  it("rejects booking for a voided or unknown sale", async () => {
    const f = await fixture();
    await voidSale(f.saleId, f.userId);
    await expect(createDelivery(bookArgs(f))).rejects.toMatchObject({ code: "SALE_VOIDED" });

    await expect(
      createDelivery({ ...bookArgs(f), saleId: 999999 }),
    ).rejects.toMatchObject({ code: "SALE_NOT_FOUND" });
  });
});

describe("changeDeliveryStatus", () => {
  beforeEach(resetAuthTables);

  it("advances the status and appends a history row", async () => {
    const f = await fixture();
    const delivery = await createDelivery(bookArgs(f));

    const scheduled = await changeDeliveryStatus(delivery.id, "SCHEDULED", f.userId, "นัดส่งแล้ว");
    expect(scheduled.status).toBe("SCHEDULED");
    expect(scheduled.history).toHaveLength(2);
  });

  it("rejects an illegal transition", async () => {
    const f = await fixture();
    const delivery = await createDelivery(bookArgs(f));
    await expect(
      changeDeliveryStatus(delivery.id, "DELIVERED", f.userId),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("rejects an unknown delivery and exposes DeliveryError with a code", async () => {
    await expect(changeDeliveryStatus(999999, "SCHEDULED", 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(new DeliveryError("NOT_FOUND", "x").code).toBe("NOT_FOUND");
  });
});
