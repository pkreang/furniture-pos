import type { Prisma, PaymentMethod } from "@prisma/client";
import { prisma } from "../prisma.js";
import { nextNumber, formatQuotationNumber } from "./numbering.js";
import { checkoutInTx, type CheckoutResult } from "./checkout.js";
import { extractVat, applyDiscount, effectiveDiscountPercent } from "./money.js";

/**
 * Decorates a quotation with its VAT-inclusive breakdown. Quotation prices are
 * VAT-inclusive; the net (line subtotal − order discount) is the gross, out of
 * which we extract the pre-VAT `taxBase` and `vatAmount` for display (never
 * stored — computed on read).
 */
export function withVat<T extends { subtotal: number; discount?: number }>(
  quotation: T,
): T & { total: number; taxBase: number; vatAmount: number } {
  const total = Math.max(0, quotation.subtotal - (quotation.discount ?? 0));
  const { taxBase, vatAmount } = extractVat(total);
  return { ...quotation, total, taxBase, vatAmount };
}

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

interface QuotationItemInput {
  productId: number;
  quantity: number;
  discountBaht?: number;
  discountPercent?: number;
}

interface CreateQuotationArgs {
  branchId: number;
  createdById: number;
  customerId?: number;
  items: QuotationItemInput[];
  note?: string;
  discountBaht?: number;
  discountPercent?: number;
  maxDiscountPercent?: number | null;
}

function validateDiscount(baht: number, percent: number): void {
  if (baht < 0 || percent < 0) {
    throw new QuotationError("INVALID_DISCOUNT", "ส่วนลดต้องไม่ติดลบ");
  }
  if (percent > 100) {
    throw new QuotationError("INVALID_DISCOUNT", "ส่วนลดต้องไม่เกิน 100%");
  }
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
      const discountBaht = item.discountBaht ?? 0;
      const discountPercent = item.discountPercent ?? 0;
      validateDiscount(discountBaht, discountPercent);
      const gross = product.basePrice * item.quantity;
      const { discount, net } = applyDiscount(gross, discountBaht, discountPercent);
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.basePrice,
        quantity: item.quantity,
        discount,
        discountBaht,
        discountPercent,
        lineTotal: net,
      };
    });
    const subtotal = itemRows.reduce((sum, r) => sum + r.lineTotal, 0);

    const orderBaht = args.discountBaht ?? 0;
    const orderPercent = args.discountPercent ?? 0;
    validateDiscount(orderBaht, orderPercent);
    const { discount: orderDiscount } = applyDiscount(subtotal, orderBaht, orderPercent);

    if (args.maxDiscountPercent !== null && args.maxDiscountPercent !== undefined) {
      const grossLines = itemRows.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
      const lineDiscounts = itemRows.reduce((s, r) => s + r.discount, 0);
      const pct = effectiveDiscountPercent(lineDiscounts + orderDiscount, grossLines);
      if (pct > args.maxDiscountPercent + 1e-9) {
        throw new QuotationError(
          "DISCOUNT_TOO_HIGH",
          `ส่วนลดเกินสิทธิ์ (สูงสุด ${args.maxDiscountPercent}%)`,
        );
      }
    }

    const seq = await nextNumber(tx, branch.id, "quote");
    const quotation = await tx.quotation.create({
      data: {
        number: formatQuotationNumber(branch.code, seq),
        branchId: branch.id,
        customerId: args.customerId,
        createdById: args.createdById,
        subtotal,
        discount: orderDiscount,
        discountBaht: orderBaht,
        discountPercent: orderPercent,
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
