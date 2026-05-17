import type { Prisma, PointTransactionReason } from "@prisma/client";

/** Raised for any loyalty-point rule violation (overdraw, unknown customer). */
export class PointError extends Error {}

interface PointArgs {
  customerId: number;
  delta: number;
  reason: PointTransactionReason;
  note?: string;
  userId?: number;
  saleId?: number;
}

/**
 * Applies one loyalty-point transaction inside a transaction: adjusts the
 * customer's points balance and appends a ledger entry. The conditional
 * `updateMany` (WHERE points_balance >= needed) re-checks the locked row, so
 * concurrent redemptions can never overdraw. Returns the resulting balance.
 */
export async function applyPointTransaction(
  tx: Prisma.TransactionClient,
  args: PointArgs,
): Promise<number> {
  const updated = await tx.customer.updateMany({
    where: { id: args.customerId, pointsBalance: { gte: -args.delta } },
    data: { pointsBalance: { increment: args.delta } },
  });
  if (updated.count === 0) {
    const exists = await tx.customer.findUnique({ where: { id: args.customerId } });
    throw new PointError(exists ? "แต้มสะสมไม่พอ" : "ไม่พบลูกค้า");
  }

  await tx.pointTransaction.create({
    data: {
      customerId: args.customerId,
      delta: args.delta,
      reason: args.reason,
      note: args.note,
      userId: args.userId,
      saleId: args.saleId,
    },
  });

  const customer = await tx.customer.findUniqueOrThrow({ where: { id: args.customerId } });
  return customer.pointsBalance;
}
