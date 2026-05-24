import { Prisma } from "@prisma/client";
import type {
  BillingType,
  SoDeliveryType,
  PaymentTerm,
  PaymentMethodKind,
  CardType,
} from "@prisma/client";
import { prisma } from "../prisma.js";
import { applyStockMovement, applyStockReservation } from "../stock/service.js";
import { nextSoCode } from "./numbering.js";

/** Raised for any sales-order rule violation; `code` is a stable error code. */
export class SoError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const soInclude = {
  items: { include: { product: true } },
  customer: true,
  branch: true,
  quotation: true,
  createdBy: { select: { id: true, name: true } },
  salesperson: { select: { id: true, name: true } },
} satisfies Prisma.SalesOrderInclude;

export type SoResult = Prisma.SalesOrderGetPayload<{ include: typeof soInclude }>;

/** VAT rate for sales orders, mirroring the PO convention (VAT added on top). */
const VAT_RATE = 0.07;

export interface SoItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  size?: string | null;
  materials?: string | null;
  color?: string | null;
}

/** Booking-form fields shared by create + update. All optional. */
export interface SoBookingFields {
  bookNo?: string | null;
  billingType?: BillingType | null;
  billingBranchNo?: string | null;
  customerPhone2?: string | null;
  addrLine1?: string | null;
  addrMoo?: string | null;
  addrSoi?: string | null;
  addrStreet?: string | null;
  addrKwang?: string | null;
  addrDistrict?: string | null;
  addrProvince?: string | null;
  addrPostal?: string | null;
  canShipImmediately?: boolean;
  deliveryType?: SoDeliveryType | null;
  deliveryTypeOther?: string | null;
  deliveryInfo?: Prisma.InputJsonValue | null;
  paymentTerm?: PaymentTerm | null;
  installmentMonths?: number | null;
  depositMethod?: PaymentMethodKind | null;
  depositCardType?: CardType | null;
  balanceMethod?: PaymentMethodKind | null;
  balanceCardType?: CardType | null;
}

export interface CreateSoArgs extends SoBookingFields {
  customerId?: number;
  branchId: number;
  createdById: number;
  salespersonId?: number;
  dueDate?: Date | null;
  deposit?: number;
  notes?: string;
  poRef?: string;
  quotationId?: number;
  discount?: number;
  items: SoItemInput[];
}

export interface UpdateSoArgs extends SoBookingFields {
  customerId?: number | null;
  branchId?: number;
  salespersonId?: number;
  dueDate?: Date | null;
  deposit?: number;
  notes?: string;
  poRef?: string;
  discount?: number;
  items: SoItemInput[];
}

interface NormalisedItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  size?: string | null;
  materials?: string | null;
  color?: string | null;
}

interface Totals {
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
}

/**
 * Computes per-line subtotals + VAT + total for a sales order. The line total
 * is `unitPrice * quantity - lineDiscount`; the SO-level `discount` is applied
 * after summing lines and before VAT. VAT is added on top (matches PO).
 */
function computeTotals(items: NormalisedItem[], orderDiscount: number): Totals {
  const linesSum = items.reduce((s, i) => s + i.lineTotal, 0);
  const subtotal = Math.max(0, linesSum - orderDiscount);
  const vatAmount = Math.round(subtotal * VAT_RATE);
  const totalAmount = subtotal + vatAmount;
  return { subtotal, vatAmount, totalAmount };
}

async function validateItems(
  tx: Prisma.TransactionClient,
  items: SoItemInput[],
): Promise<NormalisedItem[]> {
  if (items.length === 0) {
    throw new SoError("EMPTY", "ใบสั่งขายต้องมีสินค้าอย่างน้อยหนึ่งรายการ");
  }
  const productIds = items.map((i) => i.productId);
  const products = await tx.product.findMany({ where: { id: { in: productIds } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((it) => {
    if (it.quantity <= 0) {
      throw new SoError("INVALID_QTY", "จำนวนต้องมากกว่า 0");
    }
    if (it.unitPrice < 0) {
      throw new SoError("INVALID_PRICE", "ราคาต่อหน่วยต้องไม่ติดลบ");
    }
    const discount = it.discount ?? 0;
    if (discount < 0) {
      throw new SoError("INVALID_DISCOUNT", "ส่วนลดบรรทัดต้องไม่ติดลบ");
    }
    const product = byId.get(it.productId);
    if (!product) {
      throw new SoError("PRODUCT_NOT_FOUND", `ไม่พบสินค้า #${it.productId}`);
    }
    const gross = it.unitPrice * it.quantity;
    if (discount > gross) {
      throw new SoError("INVALID_DISCOUNT", "ส่วนลดบรรทัดเกินยอดรวมของรายการ");
    }
    return {
      productId: product.id,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount,
      lineTotal: gross - discount,
      size: it.size ?? null,
      materials: it.materials ?? null,
      color: it.color ?? null,
    };
  });
}

interface BookingDbFields {
  bookNo?: string | null;
  billingType?: BillingType | null;
  billingBranchNo?: string | null;
  customerPhone2?: string | null;
  addrLine1?: string | null;
  addrMoo?: string | null;
  addrSoi?: string | null;
  addrStreet?: string | null;
  addrKwang?: string | null;
  addrDistrict?: string | null;
  addrProvince?: string | null;
  addrPostal?: string | null;
  canShipImmediately?: boolean;
  deliveryType?: SoDeliveryType | null;
  deliveryTypeOther?: string | null;
  deliveryInfo?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  paymentTerm?: PaymentTerm | null;
  installmentMonths?: number | null;
  depositMethod?: PaymentMethodKind | null;
  depositCardType?: CardType | null;
  balanceMethod?: PaymentMethodKind | null;
  balanceCardType?: CardType | null;
}

/**
 * Picks just the booking-form fields out of args so they can be spread into
 * a Prisma create/update payload without leaking unrelated keys.
 */
function pickBookingFields(args: SoBookingFields): BookingDbFields {
  const data: BookingDbFields = {};
  if (args.bookNo !== undefined) data.bookNo = args.bookNo;
  if (args.billingType !== undefined) data.billingType = args.billingType;
  if (args.billingBranchNo !== undefined) data.billingBranchNo = args.billingBranchNo;
  if (args.customerPhone2 !== undefined) data.customerPhone2 = args.customerPhone2;
  if (args.addrLine1 !== undefined) data.addrLine1 = args.addrLine1;
  if (args.addrMoo !== undefined) data.addrMoo = args.addrMoo;
  if (args.addrSoi !== undefined) data.addrSoi = args.addrSoi;
  if (args.addrStreet !== undefined) data.addrStreet = args.addrStreet;
  if (args.addrKwang !== undefined) data.addrKwang = args.addrKwang;
  if (args.addrDistrict !== undefined) data.addrDistrict = args.addrDistrict;
  if (args.addrProvince !== undefined) data.addrProvince = args.addrProvince;
  if (args.addrPostal !== undefined) data.addrPostal = args.addrPostal;
  if (args.canShipImmediately !== undefined) data.canShipImmediately = args.canShipImmediately;
  if (args.deliveryType !== undefined) data.deliveryType = args.deliveryType;
  if (args.deliveryTypeOther !== undefined) data.deliveryTypeOther = args.deliveryTypeOther;
  if (args.deliveryInfo !== undefined) {
    data.deliveryInfo =
      args.deliveryInfo === null ? Prisma.JsonNull : args.deliveryInfo;
  }
  if (args.paymentTerm !== undefined) data.paymentTerm = args.paymentTerm;
  if (args.installmentMonths !== undefined) data.installmentMonths = args.installmentMonths;
  if (args.depositMethod !== undefined) data.depositMethod = args.depositMethod;
  if (args.depositCardType !== undefined) data.depositCardType = args.depositCardType;
  if (args.balanceMethod !== undefined) data.balanceMethod = args.balanceMethod;
  if (args.balanceCardType !== undefined) data.balanceCardType = args.balanceCardType;
  return data;
}

function validateDeposit(deposit: number, totalAmount: number): void {
  if (deposit < 0) throw new SoError("INVALID_DEPOSIT", "เงินมัดจำต้องไม่ติดลบ");
  if (deposit > totalAmount) {
    throw new SoError("DEPOSIT_TOO_HIGH", "เงินมัดจำเกินยอดรวม");
  }
}

/** Creates a draft sales order. Allocates a yearly code and computes totals. */
export async function createSalesOrder(args: CreateSoArgs): Promise<SoResult> {
  return prisma.$transaction(async (tx) => {
    if (args.customerId !== undefined) {
      const customer = await tx.customer.findUnique({ where: { id: args.customerId } });
      if (!customer) throw new SoError("CUSTOMER_NOT_FOUND", "ไม่พบลูกค้า");
    }
    const branch = await tx.branch.findUnique({ where: { id: args.branchId } });
    if (!branch) throw new SoError("BRANCH_NOT_FOUND", "ไม่พบสาขา");

    const itemRows = await validateItems(tx, args.items);
    const orderDiscount = args.discount ?? 0;
    if (orderDiscount < 0) {
      throw new SoError("INVALID_DISCOUNT", "ส่วนลดท้ายบิลต้องไม่ติดลบ");
    }
    const totals = computeTotals(itemRows, orderDiscount);
    const deposit = args.deposit ?? 0;
    validateDeposit(deposit, totals.totalAmount);

    const code = await nextSoCode(tx);

    const booking = pickBookingFields(args);
    const so = await tx.salesOrder.create({
      data: {
        code,
        customerId: args.customerId,
        branchId: args.branchId,
        createdById: args.createdById,
        salespersonId: args.salespersonId ?? args.createdById,
        dueDate: args.dueDate ?? null,
        deposit,
        notes: args.notes,
        poRef: args.poRef,
        quotationId: args.quotationId,
        discount: orderDiscount,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        ...booking,
        items: { create: itemRows },
      },
      include: soInclude,
    });
    return so;
  });
}

/** Replaces the line items on a draft SO and re-computes totals. */
export async function updateSalesOrder(soId: number, args: UpdateSoArgs): Promise<SoResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrder.findUnique({ where: { id: soId } });
    if (!existing) throw new SoError("NOT_FOUND", "ไม่พบใบสั่งขาย");
    if (existing.status !== "DRAFT") {
      throw new SoError("INVALID_STATUS", "แก้ไขได้เฉพาะใบสั่งขายสถานะร่าง");
    }

    if (args.customerId !== undefined && args.customerId !== null) {
      const customer = await tx.customer.findUnique({ where: { id: args.customerId } });
      if (!customer) throw new SoError("CUSTOMER_NOT_FOUND", "ไม่พบลูกค้า");
    }
    if (args.branchId !== undefined) {
      const branch = await tx.branch.findUnique({ where: { id: args.branchId } });
      if (!branch) throw new SoError("BRANCH_NOT_FOUND", "ไม่พบสาขา");
    }

    const itemRows = await validateItems(tx, args.items);
    const orderDiscount = args.discount ?? existing.discount;
    if (orderDiscount < 0) {
      throw new SoError("INVALID_DISCOUNT", "ส่วนลดท้ายบิลต้องไม่ติดลบ");
    }
    const totals = computeTotals(itemRows, orderDiscount);
    const deposit = args.deposit ?? existing.deposit;
    validateDeposit(deposit, totals.totalAmount);

    await tx.salesOrderItem.deleteMany({ where: { salesOrderId: soId } });

    const booking = pickBookingFields(args);
    const updated = await tx.salesOrder.update({
      where: { id: soId },
      data: {
        customerId:
          args.customerId === undefined ? existing.customerId : args.customerId,
        branchId: args.branchId ?? existing.branchId,
        salespersonId:
          args.salespersonId === undefined ? existing.salespersonId : args.salespersonId,
        dueDate: args.dueDate === undefined ? existing.dueDate : args.dueDate,
        notes: args.notes ?? existing.notes,
        poRef: args.poRef ?? existing.poRef,
        discount: orderDiscount,
        deposit,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        ...booking,
        items: { create: itemRows },
      },
      include: soInclude,
    });
    return updated;
  });
}

/**
 * Transitions a draft SO to CONFIRMED, reserving stock for each line. If
 * available stock at the SO's branch is insufficient for any line, the
 * transaction rolls back with INSUFFICIENT_STOCK.
 */
export async function confirmSalesOrder(soId: number): Promise<SoResult> {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({
      where: { id: soId },
      include: { items: true },
    });
    if (!so) throw new SoError("NOT_FOUND", "ไม่พบใบสั่งขาย");
    if (so.status !== "DRAFT") {
      throw new SoError("INVALID_STATUS", "ยืนยันได้เฉพาะใบสั่งขายสถานะร่าง");
    }
    if (so.items.length === 0) {
      throw new SoError("EMPTY", "ใบสั่งขายไม่มีรายการสินค้า");
    }
    try {
      for (const item of so.items) {
        await applyStockReservation(tx, {
          productId: item.productId,
          branchId: so.branchId,
          delta: item.quantity,
        });
      }
    } catch {
      throw new SoError("INSUFFICIENT_STOCK", "สต็อกไม่พอสำหรับการจอง");
    }
    return tx.salesOrder.update({
      where: { id: soId },
      data: { status: "CONFIRMED" },
      include: soInclude,
    });
  });
}

/**
 * Transitions a CONFIRMED SO to DELIVERED: consumes the reservations and
 * decrements on-hand stock in one ledger entry per line.
 */
export async function deliverSalesOrder(soId: number, userId: number): Promise<SoResult> {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({
      where: { id: soId },
      include: { items: true },
    });
    if (!so) throw new SoError("NOT_FOUND", "ไม่พบใบสั่งขาย");
    if (so.status !== "CONFIRMED") {
      throw new SoError("INVALID_STATUS", "ส่งของได้เฉพาะใบสั่งขายที่ยืนยันแล้ว");
    }
    for (const item of so.items) {
      await applyStockMovement(tx, {
        productId: item.productId,
        branchId: so.branchId,
        delta: -item.quantity,
        reason: "SO_DELIVERY",
        userId,
        salesOrderId: so.id,
      });
    }
    return tx.salesOrder.update({
      where: { id: soId },
      data: { status: "DELIVERED", deliveredDate: new Date() },
      include: soInclude,
    });
  });
}

/**
 * Cancels a DRAFT or CONFIRMED SO. Confirmed orders also release their stock
 * reservations. Delivered orders cannot be cancelled.
 */
export async function cancelSalesOrder(soId: number): Promise<SoResult> {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({
      where: { id: soId },
      include: { items: true },
    });
    if (!so) throw new SoError("NOT_FOUND", "ไม่พบใบสั่งขาย");
    if (so.status === "DELIVERED") {
      throw new SoError("INVALID_STATUS", "ยกเลิกใบสั่งขายที่ส่งของแล้วไม่ได้");
    }
    if (so.status === "CANCELLED") {
      throw new SoError("INVALID_STATUS", "ใบสั่งขายนี้ถูกยกเลิกแล้ว");
    }
    if (so.status === "CONFIRMED") {
      for (const item of so.items) {
        await applyStockReservation(tx, {
          productId: item.productId,
          branchId: so.branchId,
          delta: -item.quantity,
        });
      }
    }
    return tx.salesOrder.update({
      where: { id: soId },
      data: { status: "CANCELLED" },
      include: soInclude,
    });
  });
}

export interface ConvertQuotationArgs {
  branchId?: number;
  dueDate?: Date | null;
  deposit?: number;
  notes?: string;
  poRef?: string;
  createdById: number;
}

/**
 * Converts a quotation into a fresh draft SO. The quotation's items, customer,
 * and branch (unless overridden) seed the new SO. Status starts at DRAFT.
 */
export async function convertQuotationToSo(
  quotationId: number,
  args: ConvertQuotationArgs,
): Promise<SoResult> {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true },
    });
    if (!quotation) {
      throw new SoError("QUOTATION_NOT_FOUND", "ไม่พบใบเสนอราคา");
    }
    if (quotation.items.length === 0) {
      throw new SoError("EMPTY_QUOTATION", "ใบเสนอราคานี้ไม่มีรายการสินค้า");
    }
    const branchId = args.branchId ?? quotation.branchId;
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new SoError("BRANCH_NOT_FOUND", "ไม่พบสาขา");

    const itemRows: NormalisedItem[] = quotation.items.map((qi) => ({
      productId: qi.productId,
      quantity: qi.quantity,
      unitPrice: qi.unitPrice,
      discount: 0,
      lineTotal: qi.unitPrice * qi.quantity,
    }));
    const totals = computeTotals(itemRows, 0);
    const deposit = args.deposit ?? 0;
    validateDeposit(deposit, totals.totalAmount);

    const code = await nextSoCode(tx);

    const so = await tx.salesOrder.create({
      data: {
        code,
        customerId: quotation.customerId,
        branchId,
        quotationId: quotation.id,
        createdById: args.createdById,
        salespersonId: args.createdById,
        dueDate: args.dueDate ?? null,
        deposit,
        notes: args.notes,
        poRef: args.poRef,
        discount: 0,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        items: { create: itemRows },
      },
      include: soInclude,
    });
    return so;
  });
}
