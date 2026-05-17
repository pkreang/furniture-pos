import type { Prisma, PaymentMethod } from "@prisma/client";
import { prisma } from "../prisma.js";
import { nextNumber, formatQuotationNumber } from "./numbering.js";
import { checkoutInTx, type CheckoutResult } from "./checkout.js";

/** Raised for any quotation rule violation; `code` is a stable error code. */
export class QuotationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const quotationInclude = {
  items: true,
  branch: { select: { name: true, code: true } },
  customer: { select: { name: true, phone: true } },
} satisfies Prisma.QuotationInclude;

export type QuotationResult = Prisma.QuotationGetPayload<{ include: typeof quotationInclude }>;

interface CreateQuotationArgs {
  branchId: number;
  createdById: number;
  customerId?: number;
  items: { productId: number; quantity: number }[];
  note?: string;
}

/** Creates a quotation, snapshotting current product prices. Touches no stock. */
export async function createQuotation(args: CreateQuotationArgs): Promise<QuotationResult> {
  if (args.items.length === 0) {
    throw new QuotationError("EMPTY", "ใบเสนอราคาต้องมีสินค้าอย่างน้อยหนึ่งรายการ");
  }
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { id: args.branchId } });
    if (!branch) throw new QuotationError("BRANCH_NOT_FOUND", "ไม่พบสาขา");

    const products = await tx.product.findMany({
      where: { id: { in: args.items.map((i) => i.productId) } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const itemRows = args.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new QuotationError("PRODUCT_NOT_FOUND", `ไม่พบสินค้า #${item.productId}`);
      }
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.basePrice,
        quantity: item.quantity,
        lineTotal: product.basePrice * item.quantity,
      };
    });
    const subtotal = itemRows.reduce((sum, r) => sum + r.lineTotal, 0);

    const seq = await nextNumber(tx, branch.id, "quote");
    const quotation = await tx.quotation.create({
      data: {
        number: formatQuotationNumber(branch.code, seq),
        branchId: branch.id,
        customerId: args.customerId,
        createdById: args.createdById,
        subtotal,
        note: args.note,
        items: { create: itemRows },
      },
      include: quotationInclude,
    });
    return quotation;
  });
}

interface ConvertQuotationArgs {
  quotationId: number;
  cashierId: number;
  payments: { method: PaymentMethod; amount: number }[];
  discountPercent?: number;
  redeemPoints?: number;
  maxDiscountPercent: number | null;
}

/**
 * Converts an open quotation into a sale. The checkout and the quotation
 * status flip run in one transaction, so a conversion never half-applies.
 */
export async function convertQuotation(args: ConvertQuotationArgs): Promise<CheckoutResult> {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUnique({
      where: { id: args.quotationId },
      include: { items: true },
    });
    if (!quotation) throw new QuotationError("NOT_FOUND", "ไม่พบใบเสนอราคา");
    if (quotation.status !== "OPEN") {
      throw new QuotationError("ALREADY_CONVERTED", "ใบเสนอราคานี้ถูกแปลงเป็นบิลแล้ว");
    }

    const sale = await checkoutInTx(tx, {
      branchId: quotation.branchId,
      cashierId: args.cashierId,
      customerId: quotation.customerId ?? undefined,
      items: quotation.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      payments: args.payments,
      discountPercent: args.discountPercent,
      redeemPoints: args.redeemPoints,
      maxDiscountPercent: args.maxDiscountPercent,
    });

    await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: "CONVERTED", convertedSaleId: sale.id },
    });
    return sale;
  });
}
