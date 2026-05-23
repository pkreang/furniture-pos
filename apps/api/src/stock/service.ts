import type { StockMovementReason, Transfer } from "@prisma/client";
import { Prisma } from "@prisma/client";
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
  salesOrderId?: number;
}

/**
 * Reasons that consume on-hand stock (negative delta) and must respect the
 * `reservedQty` "soft hold" — outright sales and outgoing transfers can't dip
 * into stock that is already promised to a confirmed SO.
 */
const DECREMENT_RESPECTS_RESERVATION: ReadonlySet<StockMovementReason> = new Set([
  "SALE",
  "TRANSFER_OUT",
]);

/**
 * Applies one stock movement inside a transaction: ensures the stock level row
 * exists, adjusts the quantity, and appends a ledger entry. The conditional
 * `updateMany` re-checks the locked row, so concurrent decrements can never
 * drive the quantity below zero. For decrements that must respect SO holds
 * (SALE, TRANSFER_OUT) the gate is `quantity - reservedQty >= needed`. For
 * `SO_DELIVERY` the reservation is consumed in the same call: `reservedQty`
 * is decremented along with `quantity`, and the gate uses `quantity` alone
 * because that reservation was already accounted for at confirmation time.
 * Returns the resulting on-hand quantity.
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

  if (args.delta < 0) {
    const needed = -args.delta;
    if (args.reason === "SO_DELIVERY") {
      // Delivery: gate on raw quantity (reservation is being consumed in this
      // same statement, so subtracting it again would double-count).
      const updated = await tx.stockLevel.updateMany({
        where: {
          productId: args.productId,
          branchId: args.branchId,
          quantity: { gte: needed },
          reservedQty: { gte: needed },
        },
        data: {
          quantity: { increment: args.delta },
          reservedQty: { decrement: needed },
        },
      });
      if (updated.count === 0) {
        throw new StockError("สต็อกไม่พอสำหรับการเคลื่อนไหวนี้");
      }
    } else if (DECREMENT_RESPECTS_RESERVATION.has(args.reason)) {
      // Hand-write the available-stock gate as raw SQL because Prisma's
      // typed `where` can't compare two columns of the same row directly.
      const rows = await tx.$executeRaw(Prisma.sql`
        UPDATE "stock_levels"
        SET "quantity" = "quantity" + ${args.delta}
        WHERE "product_id" = ${args.productId}
          AND "branch_id" = ${args.branchId}
          AND "quantity" - "reserved_qty" >= ${needed}
      `);
      if (rows === 0) {
        throw new StockError("สต็อกไม่พอสำหรับการเคลื่อนไหวนี้");
      }
    } else {
      const updated = await tx.stockLevel.updateMany({
        where: {
          productId: args.productId,
          branchId: args.branchId,
          quantity: { gte: needed },
        },
        data: { quantity: { increment: args.delta } },
      });
      if (updated.count === 0) {
        throw new StockError("สต็อกไม่พอสำหรับการเคลื่อนไหวนี้");
      }
    }
  } else {
    await tx.stockLevel.update({
      where,
      data: { quantity: { increment: args.delta } },
    });
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
      salesOrderId: args.salesOrderId,
    },
  });

  const level = await tx.stockLevel.findUniqueOrThrow({ where });
  return level.quantity;
}

interface ReservationArgs {
  productId: number;
  branchId: number;
  /** Positive to reserve, negative to release. */
  delta: number;
}

/**
 * Adjusts the soft-hold `reservedQty` on a stock level row inside a
 * transaction. Reservations cannot exceed currently available on-hand stock
 * (`quantity - reservedQty`); releases can never drive `reservedQty` below
 * zero. Returns the resulting `reservedQty`. No ledger row is written — the
 * caller is expected to log the surrounding SO event separately.
 */
export async function applyStockReservation(
  tx: Prisma.TransactionClient,
  args: ReservationArgs,
): Promise<number> {
  if (args.delta === 0) {
    throw new StockError("การจองสต็อกต้องไม่เป็นศูนย์");
  }
  const where = { productId_branchId: { productId: args.productId, branchId: args.branchId } };
  await tx.stockLevel.upsert({
    where,
    update: {},
    create: { productId: args.productId, branchId: args.branchId, quantity: 0 },
  });

  if (args.delta > 0) {
    // Reserve: require quantity - reservedQty >= delta. Use raw SQL for the
    // two-column comparison.
    const rows = await tx.$executeRaw(Prisma.sql`
      UPDATE "stock_levels"
      SET "reserved_qty" = "reserved_qty" + ${args.delta}
      WHERE "product_id" = ${args.productId}
        AND "branch_id" = ${args.branchId}
        AND "quantity" - "reserved_qty" >= ${args.delta}
    `);
    if (rows === 0) {
      throw new StockError("สต็อกที่เหลือไม่พอสำหรับการจอง");
    }
  } else {
    const releaseQty = -args.delta;
    const updated = await tx.stockLevel.updateMany({
      where: {
        productId: args.productId,
        branchId: args.branchId,
        reservedQty: { gte: releaseQty },
      },
      data: { reservedQty: { decrement: releaseQty } },
    });
    if (updated.count === 0) {
      throw new StockError("ปลดล็อกสต็อกได้มากกว่าที่ถูกจองไว้");
    }
  }

  const level = await tx.stockLevel.findUniqueOrThrow({ where });
  return level.reservedQty;
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
