import type { Prisma, PaymentMethod, TaxInvoiceType } from "@prisma/client";
import { prisma } from "../prisma.js";
import { applyStockMovement } from "../stock/service.js";
import { applyPointTransaction } from "../membership/points.js";
import { extractVat, calcPointsEarned } from "./money.js";
import { nextNumber, formatSaleNumber } from "./numbering.js";

/** Raised for any checkout rule violation; `code` is a stable error code. */
export class CheckoutError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface CheckoutItem {
  productId: number;
  quantity: number;
}

interface CheckoutPayment {
  method: PaymentMethod;
  amount: number;
}

export interface CheckoutArgs {
  branchId: number;
  cashierId: number;
  customerId?: number;
  items: CheckoutItem[];
  payments: CheckoutPayment[];
  discountPercent?: number;
  redeemPoints?: number;
  /** The cashier's role discount cap; `null` means unlimited. */
  maxDiscountPercent: number | null;
}

const saleInclude = {
  items: true,
  payments: true,
  taxInvoice: true,
  customer: true,
} satisfies Prisma.SaleInclude;

export type CheckoutResult = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

/**
 * Runs a complete checkout inside a single transaction: prices and snapshots
 * the cart, applies a capped discount and optional point redemption, extracts
 * VAT, allocates a per-branch number, writes the sale/items/payments/tax
 * invoice, decrements stock, and earns/redeems loyalty points. Any failure
 * rolls the whole transaction back.
 */
export async function checkout(args: CheckoutArgs): Promise<CheckoutResult> {
  const discountPercent = args.discountPercent ?? 0;
  const redeemPoints = args.redeemPoints ?? 0;

  if (args.items.length === 0) {
    throw new CheckoutError("EMPTY_CART", "ไม่มีสินค้าในตะกร้า");
  }
  if (discountPercent < 0 || discountPercent > 100) {
    throw new CheckoutError("DISCOUNT_TOO_HIGH", "ส่วนลดไม่ถูกต้อง");
  }
  if (args.maxDiscountPercent !== null && discountPercent > args.maxDiscountPercent) {
    throw new CheckoutError(
      "DISCOUNT_TOO_HIGH",
      `ส่วนลดเกินสิทธิ์ (สูงสุด ${args.maxDiscountPercent}%)`,
    );
  }
  if (redeemPoints < 0) {
    throw new CheckoutError("INVALID_REDEEM", "แต้มที่ใช้ไม่ถูกต้อง");
  }
  if (redeemPoints > 0 && args.customerId === undefined) {
    throw new CheckoutError("REDEEM_WITHOUT_CUSTOMER", "ต้องระบุลูกค้าเพื่อใช้แต้ม");
  }

  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { id: args.branchId } });
    if (!branch) throw new CheckoutError("BRANCH_NOT_FOUND", "ไม่พบสาขา");
    if (branch.isWarehouse) {
      throw new CheckoutError("WAREHOUSE_NO_SALE", "สาขาคลังสินค้าไม่สามารถขายได้");
    }

    let customer = null;
    if (args.customerId !== undefined) {
      customer = await tx.customer.findUnique({ where: { id: args.customerId } });
      if (!customer) throw new CheckoutError("CUSTOMER_NOT_FOUND", "ไม่พบลูกค้า");
    }

    const products = await tx.product.findMany({
      where: { id: { in: args.items.map((i) => i.productId) } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const itemRows = args.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new CheckoutError("PRODUCT_NOT_FOUND", `ไม่พบสินค้า #${item.productId}`);
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
    const discountAmount = Math.round((subtotal * discountPercent) / 100);
    const total = subtotal - discountAmount - redeemPoints;
    if (total < 0) throw new CheckoutError("NEGATIVE_TOTAL", "ยอดสุทธิติดลบ");

    const paymentSum = args.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paymentSum !== total) {
      throw new CheckoutError("PAYMENT_MISMATCH", "ยอดชำระไม่ตรงกับยอดสุทธิ");
    }

    const { taxBase, vatAmount } = extractVat(total);
    const pointsEarned = customer ? calcPointsEarned(total) : 0;

    const seq = await nextNumber(tx, branch.id, "sale");
    const sale = await tx.sale.create({
      data: {
        number: formatSaleNumber(branch.code, seq),
        branchId: branch.id,
        customerId: args.customerId,
        cashierId: args.cashierId,
        subtotal,
        discountAmount,
        pointsRedeemed: redeemPoints,
        total,
        taxBase,
        vatAmount,
        pointsEarned,
      },
    });

    await tx.saleItem.createMany({
      data: itemRows.map((r) => ({ ...r, saleId: sale.id })),
    });
    await tx.payment.createMany({
      data: args.payments.map((p) => ({ saleId: sale.id, method: p.method, amount: p.amount })),
    });

    for (const item of args.items) {
      await applyStockMovement(tx, {
        productId: item.productId,
        branchId: branch.id,
        delta: -item.quantity,
        reason: "SALE",
        userId: args.cashierId,
        saleId: sale.id,
      });
    }

    const taxType: TaxInvoiceType = customer?.taxId ? "FULL" : "ABBREVIATED";
    await tx.taxInvoice.create({
      data: {
        saleId: sale.id,
        type: taxType,
        customerTaxId: taxType === "FULL" ? customer!.taxId : null,
        customerTaxName: taxType === "FULL" ? customer!.taxName : null,
        customerTaxAddress: taxType === "FULL" ? customer!.taxAddress : null,
      },
    });

    if (customer) {
      if (redeemPoints > 0) {
        await applyPointTransaction(tx, {
          customerId: customer.id,
          delta: -redeemPoints,
          reason: "REDEEM",
          userId: args.cashierId,
          saleId: sale.id,
        });
      }
      if (pointsEarned > 0) {
        await applyPointTransaction(tx, {
          customerId: customer.id,
          delta: pointsEarned,
          reason: "EARN",
          userId: args.cashierId,
          saleId: sale.id,
        });
      }
      await tx.customer.update({
        where: { id: customer.id },
        data: { lifetimeSpend: { increment: total } },
      });
    }

    return tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: saleInclude });
  });
}
