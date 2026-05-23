import type { Prisma, StockMovementReason, Transfer } from "@prisma/client";
import { prisma } from "../prisma.js";

/** Raised for any stock rule violation (insufficient stock, bad transfer args). */
export class StockError extends Error {}

interface MovementArgs {
  productId: number;
  branchId: number;
  delta: number;
  reason: StockMovementReason;
  note?: string;
  userId?: number;
  transferId?: number;
  saleId?: number;
  purchaseOrderId?: number;
}

/**
 * Applies one stock movement inside a transaction: ensures the stock level row
 * exists, adjusts the quantity, and appends a ledger entry. The conditional
 * `updateMany` (WHERE quantity >= needed) re-checks the locked row, so
 * concurrent decrements can never drive the quantity below zero. Returns the
 * resulting on-hand quantity.
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  args: MovementArgs,
): Promise<number> {
  const where = { productId_branchId: { productId: args.productId, branchId: args.branchId } };

  await tx.stockLevel.upsert({
    where,
    update: {},
    create: { productId: args.productId, branchId: args.branchId, quantity: 0 },
  });

  const updated = await tx.stockLevel.updateMany({
    where: {
      productId: args.productId,
      branchId: args.branchId,
      quantity: { gte: -args.delta },
    },
    data: { quantity: { increment: args.delta } },
  });
  if (updated.count === 0) {
    throw new StockError("สต็อกไม่พอสำหรับการเคลื่อนไหวนี้");
  }

  await tx.stockMovement.create({
    data: {
      productId: args.productId,
      branchId: args.branchId,
      delta: args.delta,
      reason: args.reason,
      note: args.note,
      userId: args.userId,
      transferId: args.transferId,
      saleId: args.saleId,
      purchaseOrderId: args.purchaseOrderId,
    },
  });

  const level = await tx.stockLevel.findUniqueOrThrow({ where });
  return level.quantity;
}

interface TransferArgs {
  productId: number;
  fromBranchId: number;
  toBranchId: number;
  quantity: number;
  note?: string;
  userId?: number;
}

/**
 * Transfers stock between branches: one Transfer row plus a TRANSFER_OUT and a
 * TRANSFER_IN movement, all in a single transaction. If the source lacks
 * stock, `applyStockMovement` throws and the whole transfer rolls back.
 */
export async function transferStock(args: TransferArgs): Promise<Transfer> {
  if (args.quantity <= 0) {
    throw new StockError("จำนวนที่โอนต้องมากกว่า 0");
  }
  if (args.fromBranchId === args.toBranchId) {
    throw new StockError("สาขาต้นทางและปลายทางต้องไม่ใช่สาขาเดียวกัน");
  }

  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.create({
      data: {
        productId: args.productId,
        fromBranchId: args.fromBranchId,
        toBranchId: args.toBranchId,
        quantity: args.quantity,
        note: args.note,
        userId: args.userId,
      },
    });

    await applyStockMovement(tx, {
      productId: args.productId,
      branchId: args.fromBranchId,
      delta: -args.quantity,
      reason: "TRANSFER_OUT",
      note: args.note,
      userId: args.userId,
      transferId: transfer.id,
    });
    await applyStockMovement(tx, {
      productId: args.productId,
      branchId: args.toBranchId,
      delta: args.quantity,
      reason: "TRANSFER_IN",
      note: args.note,
      userId: args.userId,
      transferId: transfer.id,
    });

    return transfer;
  });
}
