import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { nextPoCode } from "../sales/numbering.js";

/** Raised for any purchase-order rule violation; `code` is a stable error code. */
export class POError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const poInclude = {
  items: { include: { product: true } },
  supplier: true,
  branch: true,
} satisfies Prisma.PurchaseOrderInclude;

export type POResult = Prisma.PurchaseOrderGetPayload<{ include: typeof poInclude }>;

/** VAT rate for purchase orders, mirrored from sales tax handling. */
const VAT_RATE = 0.07;

export interface PoItemInput {
  productId: number;
  orderedQty: number;
  unitCost: number;
}

export interface CreatePOArgs {
  supplierId: number;
  branchId: number;
  createdById: number;
  expectedDate?: Date | null;
  notes?: string;
  items: PoItemInput[];
}

export interface UpdatePOArgs {
  supplierId?: number;
  branchId?: number;
  expectedDate?: Date | null;
  notes?: string;
  items: PoItemInput[];
}

/**
 * Computes subtotal/VAT/total from a list of priced items. VAT is added on top
 * of the subtotal (PO totals are gross), matching the convention chosen for
 * purchase orders (note: sales extract VAT from a tax-inclusive total instead).
 */
function computeTotals(items: { unitCost: number; orderedQty: number }[]): {
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
} {
  const subtotal = items.reduce((s, i) => s + i.unitCost * i.orderedQty, 0);
  const vatAmount = Math.round(subtotal * VAT_RATE);
  const totalAmount = subtotal + vatAmount;
  return { subtotal, vatAmount, totalAmount };
}

async function validateItems(
  tx: Prisma.TransactionClient,
  items: PoItemInput[],
): Promise<{ productId: number; orderedQty: number; unitCost: number; lineTotal: number }[]> {
  if (items.length === 0) {
    throw new POError("EMPTY", "ใบสั่งซื้อต้องมีสินค้าอย่างน้อยหนึ่งรายการ");
  }
  const productIds = items.map((i) => i.productId);
  const products = await tx.product.findMany({ where: { id: { in: productIds } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((it) => {
    if (it.orderedQty <= 0) {
      throw new POError("INVALID_QTY", "จำนวนสั่งต้องมากกว่า 0");
    }
    if (it.unitCost < 0) {
      throw new POError("INVALID_COST", "ต้นทุนต่อหน่วยต้องไม่ติดลบ");
    }
    const product = byId.get(it.productId);
    if (!product) {
      throw new POError("PRODUCT_NOT_FOUND", `ไม่พบสินค้า #${it.productId}`);
    }
    return {
      productId: product.id,
      orderedQty: it.orderedQty,
      unitCost: it.unitCost,
      lineTotal: it.unitCost * it.orderedQty,
    };
  });
}

/** Creates a draft purchase order. Allocates a yearly code and computes totals. */
export async function createPurchaseOrder(args: CreatePOArgs): Promise<POResult> {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: args.supplierId } });
    if (!supplier) throw new POError("SUPPLIER_NOT_FOUND", "ไม่พบซัพพลายเออร์");
    if (!supplier.isActive) {
      throw new POError("SUPPLIER_INACTIVE", "ซัพพลายเออร์นี้ถูกปิดใช้งาน");
    }

    const branch = await tx.branch.findUnique({ where: { id: args.branchId } });
    if (!branch) throw new POError("BRANCH_NOT_FOUND", "ไม่พบสาขา");

    const itemRows = await validateItems(tx, args.items);
    const totals = computeTotals(itemRows);
    const code = await nextPoCode(tx);

    const po = await tx.purchaseOrder.create({
      data: {
        code,
        supplierId: args.supplierId,
        branchId: args.branchId,
        createdById: args.createdById,
        expectedDate: args.expectedDate ?? null,
        notes: args.notes,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        items: { create: itemRows },
      },
      include: poInclude,
    });
    return po;
  });
}

/** Replaces the line items on a draft PO and re-computes totals. */
export async function updatePurchaseOrder(
  poId: number,
  args: UpdatePOArgs,
): Promise<POResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseOrder.findUnique({ where: { id: poId } });
    if (!existing) throw new POError("NOT_FOUND", "ไม่พบใบสั่งซื้อ");
    if (existing.status !== "DRAFT") {
      throw new POError("INVALID_STATUS", "แก้ไขได้เฉพาะใบสั่งซื้อสถานะร่าง");
    }

    if (args.supplierId !== undefined) {
      const supplier = await tx.supplier.findUnique({ where: { id: args.supplierId } });
      if (!supplier) throw new POError("SUPPLIER_NOT_FOUND", "ไม่พบซัพพลายเออร์");
      if (!supplier.isActive) {
        throw new POError("SUPPLIER_INACTIVE", "ซัพพลายเออร์นี้ถูกปิดใช้งาน");
      }
    }
    if (args.branchId !== undefined) {
      const branch = await tx.branch.findUnique({ where: { id: args.branchId } });
      if (!branch) throw new POError("BRANCH_NOT_FOUND", "ไม่พบสาขา");
    }

    const itemRows = await validateItems(tx, args.items);
    const totals = computeTotals(itemRows);

    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });

    const updated = await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        supplierId: args.supplierId ?? existing.supplierId,
        branchId: args.branchId ?? existing.branchId,
        expectedDate: args.expectedDate === undefined ? existing.expectedDate : args.expectedDate,
        notes: args.notes ?? existing.notes,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        items: { create: itemRows },
      },
      include: poInclude,
    });
    return updated;
  });
}

/** Transitions a draft PO to CONFIRMED. */
export async function confirmPurchaseOrder(poId: number): Promise<POResult> {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) throw new POError("NOT_FOUND", "ไม่พบใบสั่งซื้อ");
    if (po.status !== "DRAFT") {
      throw new POError("INVALID_STATUS", "ยืนยันได้เฉพาะใบสั่งซื้อสถานะร่าง");
    }
    if (po.items.length === 0) {
      throw new POError("EMPTY", "ใบสั่งซื้อไม่มีรายการสินค้า");
    }
    return tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: "CONFIRMED" },
      include: poInclude,
    });
  });
}

export interface ReceiveItemInput {
  itemId: number;
  qty: number;
}

export interface ReceivePOArgs {
  items: ReceiveItemInput[];
  userId: number;
}

/**
 * Receives goods against a PO: increments stock at the PO's destination branch
 * and bumps the per-item `receivedQty`. Recomputes the PO status afterwards.
 */
export async function receivePurchaseOrder(
  poId: number,
  args: ReceivePOArgs,
): Promise<POResult> {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) throw new POError("NOT_FOUND", "ไม่พบใบสั่งซื้อ");
    if (po.status !== "CONFIRMED" && po.status !== "PARTIALLY_RECEIVED") {
      throw new POError("INVALID_STATUS", "รับของได้เฉพาะใบสั่งซื้อที่ยืนยันแล้ว");
    }
    if (args.items.length === 0) {
      throw new POError("EMPTY", "ต้องระบุรายการที่ต้องการรับอย่างน้อยหนึ่งรายการ");
    }
    const itemById = new Map(po.items.map((i) => [i.id, i]));

    for (const entry of args.items) {
      const item = itemById.get(entry.itemId);
      if (!item) {
        throw new POError("ITEM_NOT_FOUND", `ไม่พบรายการ #${entry.itemId} ในใบสั่งซื้อ`);
      }
      if (entry.qty <= 0) {
        throw new POError("INVALID_QTY", "จำนวนที่รับต้องมากกว่า 0");
      }
      if (item.receivedQty + entry.qty > item.orderedQty) {
        throw new POError(
          "OVER_RECEIVE",
          `รับเกินจำนวนสั่งสำหรับสินค้า #${item.productId}`,
        );
      }
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: { increment: entry.qty } },
      });
      await applyStockMovement(tx, {
        productId: item.productId,
        branchId: po.branchId,
        delta: entry.qty,
        reason: "PO_RECEIVE",
        userId: args.userId,
        purchaseOrderId: po.id,
      });
    }

    const refreshed = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      include: { items: true },
    });
    const allReceived = refreshed.items.every((i) => i.receivedQty >= i.orderedQty);
    const anyReceived = refreshed.items.some((i) => i.receivedQty > 0);
    let nextStatus = refreshed.status;
    let receivedDate = refreshed.receivedDate;
    if (allReceived) {
      nextStatus = "FULLY_RECEIVED";
      receivedDate = new Date();
    } else if (anyReceived) {
      nextStatus = "PARTIALLY_RECEIVED";
    }

    return tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: nextStatus, receivedDate },
      include: poInclude,
    });
  });
}

/** Cancels a PO that has not yet been received against. */
export async function cancelPurchaseOrder(poId: number): Promise<POResult> {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) throw new POError("NOT_FOUND", "ไม่พบใบสั่งซื้อ");
    if (po.status !== "DRAFT" && po.status !== "CONFIRMED") {
      throw new POError("INVALID_STATUS", "ยกเลิกได้เฉพาะใบสั่งซื้อสถานะร่างหรือยืนยันเท่านั้น");
    }
    if (po.items.some((i) => i.receivedQty > 0)) {
      throw new POError("ALREADY_RECEIVED", "ใบสั่งซื้อนี้มีการรับของแล้ว ยกเลิกไม่ได้");
    }
    return tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: "CANCELLED" },
      include: poInclude,
    });
  });
}
