import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { applyPointTransaction } from "../membership/points.js";

/** Raised when a sale cannot be voided; `code` is a stable error code. */
export class VoidError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const voidInclude = {
  items: true,
  payments: true,
  taxInvoice: true,
  customer: true,
} satisfies Prisma.SaleInclude;

export type VoidResult = Prisma.SaleGetPayload<{ include: typeof voidInclude }>;

/**
 * Fully reverses a completed sale in one transaction: returns every sold unit
 * to stock, gives back redeemed points, claws back earned points (clamped to
 * the member's current balance), drops `lifetimeSpend`, and marks the sale
 * `VOIDED`.
 */
export async function voidSale(
  saleId: number,
  voidedById: number,
  reason?: string,
): Promise<VoidResult> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { items: true } });
    if (!sale) throw new VoidError("NOT_FOUND", "ไม่พบรายการขาย");
    if (sale.status === "VOIDED") {
      throw new VoidError("ALREADY_VOIDED", "บิลนี้ถูกยกเลิกไปแล้ว");
    }

    for (const item of sale.items) {
      await applyStockMovement(tx, {
        productId: item.productId,
        branchId: sale.branchId,
        delta: item.quantity,
        reason: "REFUND",
        saleId: sale.id,
        userId: voidedById,
      });
    }

    if (sale.customerId !== null) {
      if (sale.pointsRedeemed > 0) {
        await applyPointTransaction(tx, {
          customerId: sale.customerId,
          delta: sale.pointsRedeemed,
          reason: "REFUND",
          saleId: sale.id,
          userId: voidedById,
        });
      }
      if (sale.pointsEarned > 0) {
        const customer = await tx.customer.findUniqueOrThrow({ where: { id: sale.customerId } });
        const clawback = Math.min(sale.pointsEarned, customer.pointsBalance);
        if (clawback > 0) {
          await applyPointTransaction(tx, {
            customerId: sale.customerId,
            delta: -clawback,
            reason: "REFUND",
            saleId: sale.id,
            userId: voidedById,
          });
        }
      }
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { lifetimeSpend: { decrement: sale.total } },
      });
    }

    return tx.sale.update({
      where: { id: sale.id },
      data: {
        status: "VOIDED",
        voidReason: reason,
        voidedById,
        voidedAt: new Date(),
      },
      include: voidInclude,
    });
  });
}
