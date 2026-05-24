import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { branchFilter } from "../auth/branch-scope.js";
import {
  createSalesOrder,
  updateSalesOrder,
  confirmSalesOrder,
  deliverSalesOrder,
  cancelSalesOrder,
  convertQuotationToSo,
  SoError,
} from "../sales/sales-order.js";
import { StockError } from "../stock/service.js";

const SO_STATUSES = ["DRAFT", "CONFIRMED", "DELIVERED", "CANCELLED"] as const;
const BILLING_TYPES = ["HEAD_OFFICE", "BRANCH"] as const;
const SO_DELIVERY_TYPES = ["COMPANY", "SELF_PICKUP", "OTHER"] as const;
const PAYMENT_TERMS = ["DEPOSIT", "FULL", "INSTALLMENT"] as const;
const PAYMENT_METHOD_KINDS = ["CASH", "TRANSFER", "CREDIT_CARD"] as const;
const CARD_TYPES = ["VISA", "MASTERCARD", "OTHER"] as const;

const soItemSchema = {
  type: "object",
  required: ["productId", "quantity", "unitPrice"],
  properties: {
    productId: { type: "integer" },
    quantity: { type: "integer", minimum: 1 },
    unitPrice: { type: "integer", minimum: 0 },
    discount: { type: "integer", minimum: 0 },
    size: { type: ["string", "null"] },
    materials: { type: ["string", "null"] },
    color: { type: ["string", "null"] },
  },
};

const bookingFieldProps = {
  bookNo: { type: ["string", "null"] },
  billingType: { type: ["string", "null"], enum: [...BILLING_TYPES, null] },
  billingBranchNo: { type: ["string", "null"] },
  customerPhone2: { type: ["string", "null"] },
  addrLine1: { type: ["string", "null"] },
  addrMoo: { type: ["string", "null"] },
  addrSoi: { type: ["string", "null"] },
  addrStreet: { type: ["string", "null"] },
  addrKwang: { type: ["string", "null"] },
  addrDistrict: { type: ["string", "null"] },
  addrProvince: { type: ["string", "null"] },
  addrPostal: { type: ["string", "null"] },
  canShipImmediately: { type: "boolean" },
  deliveryType: { type: ["string", "null"], enum: [...SO_DELIVERY_TYPES, null] },
  deliveryTypeOther: { type: ["string", "null"] },
  deliveryInfo: { type: ["object", "null"] },
  paymentTerm: { type: ["string", "null"], enum: [...PAYMENT_TERMS, null] },
  installmentMonths: { type: ["integer", "null"], minimum: 0 },
  depositMethod: { type: ["string", "null"], enum: [...PAYMENT_METHOD_KINDS, null] },
  depositCardType: { type: ["string", "null"], enum: [...CARD_TYPES, null] },
  balanceMethod: { type: ["string", "null"], enum: [...PAYMENT_METHOD_KINDS, null] },
  balanceCardType: { type: ["string", "null"], enum: [...CARD_TYPES, null] },
};

const soBodySchema = {
  type: "object",
  required: ["branchId", "items"],
  properties: {
    customerId: { type: "integer" },
    branchId: { type: "integer" },
    dueDate: { type: "string" },
    deposit: { type: "integer", minimum: 0 },
    notes: { type: "string" },
    poRef: { type: "string" },
    discount: { type: "integer", minimum: 0 },
    items: { type: "array", minItems: 1, items: soItemSchema },
    ...bookingFieldProps,
  },
};

const soPatchSchema = {
  type: "object",
  required: ["items"],
  properties: {
    customerId: { type: ["integer", "null"] },
    branchId: { type: "integer" },
    dueDate: { type: "string" },
    deposit: { type: "integer", minimum: 0 },
    notes: { type: "string" },
    poRef: { type: "string" },
    discount: { type: "integer", minimum: 0 },
    items: { type: "array", minItems: 1, items: soItemSchema },
    ...bookingFieldProps,
  },
};

type BillingTypeStr = (typeof BILLING_TYPES)[number];
type SoDeliveryTypeStr = (typeof SO_DELIVERY_TYPES)[number];
type PaymentTermStr = (typeof PAYMENT_TERMS)[number];
type PaymentMethodKindStr = (typeof PAYMENT_METHOD_KINDS)[number];
type CardTypeStr = (typeof CARD_TYPES)[number];

interface SoItemBody {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  size?: string | null;
  materials?: string | null;
  color?: string | null;
}

interface SoBody {
  customerId?: number | null;
  branchId: number;
  dueDate?: string;
  deposit?: number;
  notes?: string;
  poRef?: string;
  discount?: number;
  items: SoItemBody[];
  bookNo?: string | null;
  billingType?: BillingTypeStr | null;
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
  deliveryType?: SoDeliveryTypeStr | null;
  deliveryTypeOther?: string | null;
  deliveryInfo?: Record<string, unknown> | null;
  paymentTerm?: PaymentTermStr | null;
  installmentMonths?: number | null;
  depositMethod?: PaymentMethodKindStr | null;
  depositCardType?: CardTypeStr | null;
  balanceMethod?: PaymentMethodKindStr | null;
  balanceCardType?: CardTypeStr | null;
}

/** Plucks the booking-form fields from the request body so they can be passed
 * through to the service layer's create/update args verbatim. */
function bookingArgs(body: SoBody): Record<string, unknown> {
  return {
    bookNo: body.bookNo,
    billingType: body.billingType,
    billingBranchNo: body.billingBranchNo,
    customerPhone2: body.customerPhone2,
    addrLine1: body.addrLine1,
    addrMoo: body.addrMoo,
    addrSoi: body.addrSoi,
    addrStreet: body.addrStreet,
    addrKwang: body.addrKwang,
    addrDistrict: body.addrDistrict,
    addrProvince: body.addrProvince,
    addrPostal: body.addrPostal,
    canShipImmediately: body.canShipImmediately,
    deliveryType: body.deliveryType,
    deliveryTypeOther: body.deliveryTypeOther,
    deliveryInfo: body.deliveryInfo,
    paymentTerm: body.paymentTerm,
    installmentMonths: body.installmentMonths,
    depositMethod: body.depositMethod,
    depositCardType: body.depositCardType,
    balanceMethod: body.balanceMethod,
    balanceCardType: body.balanceCardType,
  };
}

function parseDate(input: string | undefined): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === "") return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export async function salesOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/sales-orders",
    {
      preHandler: [app.authenticate, app.requirePermission("so.view")],
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            customerId: { type: "string" },
            branchId: { type: "string" },
            q: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { status, customerId, branchId, q } = request.query as {
        status?: string;
        customerId?: string;
        branchId?: string;
        q?: string;
      };
      const where: Prisma.SalesOrderWhereInput = { ...branchFilter(request.user!) };
      if (status && (SO_STATUSES as readonly string[]).includes(status)) {
        where.status = status as (typeof SO_STATUSES)[number];
      }
      if (customerId) {
        const id = Number(customerId);
        if (!Number.isNaN(id)) where.customerId = id;
      }
      if (branchId && !request.user!.isBranchScoped) {
        const id = Number(branchId);
        if (!Number.isNaN(id)) where.branchId = id;
      }
      if (q && q.length > 0) {
        where.code = { contains: q };
      }
      return prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { id: "desc" },
        take: 200,
      });
    },
  );

  app.get(
    "/api/sales-orders/:id",
    { preHandler: [app.authenticate, app.requirePermission("so.view")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const so = await prisma.salesOrder.findFirst({
        where: { id, ...branchFilter(request.user!) },
        include: {
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
          customer: true,
          branch: true,
          quotation: { select: { id: true, number: true } },
        },
      });
      if (!so) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งขาย" });
      }
      return so;
    },
  );

  app.post(
    "/api/sales-orders",
    {
      preHandler: [app.authenticate, app.requirePermission("so.manage")],
      schema: { body: soBodySchema },
    },
    async (request, reply) => {
      const body = request.body as SoBody;
      const user = request.user!;
      if (user.isBranchScoped && body.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "สร้างใบสั่งขายได้เฉพาะสาขาของตนเอง" });
      }
      try {
        const so = await createSalesOrder({
          customerId: body.customerId ?? undefined,
          branchId: body.branchId,
          createdById: user.id,
          dueDate: parseDate(body.dueDate) ?? null,
          deposit: body.deposit,
          notes: body.notes,
          poRef: body.poRef,
          discount: body.discount,
          items: body.items,
          ...bookingArgs(body),
        });
        return reply.code(201).send(so);
      } catch (err) {
        if (err instanceof SoError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.patch(
    "/api/sales-orders/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("so.manage")],
      schema: { body: soPatchSchema },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const body = request.body as SoBody;
      const user = request.user!;
      const existing = await prisma.salesOrder.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งขาย" });
      }
      if (user.isBranchScoped && existing.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "แก้ไขได้เฉพาะใบสั่งขายสาขาของตนเอง" });
      }
      if (user.isBranchScoped && body.branchId !== undefined && body.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "สาขาปลายทางต้องเป็นสาขาของตนเอง" });
      }
      try {
        const so = await updateSalesOrder(id, {
          customerId: body.customerId === undefined ? undefined : body.customerId,
          branchId: body.branchId,
          dueDate: parseDate(body.dueDate),
          deposit: body.deposit,
          notes: body.notes,
          poRef: body.poRef,
          discount: body.discount,
          items: body.items,
          ...bookingArgs(body),
        });
        return so;
      } catch (err) {
        if (err instanceof SoError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/sales-orders/:id/confirm",
    { preHandler: [app.authenticate, app.requirePermission("so.manage")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const user = request.user!;
      const existing = await prisma.salesOrder.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งขาย" });
      }
      if (user.isBranchScoped && existing.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "ยืนยันได้เฉพาะใบสั่งขายสาขาของตนเอง" });
      }
      try {
        const so = await confirmSalesOrder(id);
        return so;
      } catch (err) {
        if (err instanceof SoError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        if (err instanceof StockError) {
          return reply.code(400).send({ code: "INSUFFICIENT_STOCK", message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/sales-orders/:id/deliver",
    { preHandler: [app.authenticate, app.requirePermission("so.fulfill")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const user = request.user!;
      const existing = await prisma.salesOrder.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งขาย" });
      }
      if (user.isBranchScoped && existing.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "ส่งของได้เฉพาะใบสั่งขายสาขาของตนเอง" });
      }
      try {
        const so = await deliverSalesOrder(id, user.id);
        return so;
      } catch (err) {
        if (err instanceof SoError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        if (err instanceof StockError) {
          return reply.code(400).send({ code: "INSUFFICIENT_STOCK", message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/sales-orders/:id/cancel",
    { preHandler: [app.authenticate, app.requirePermission("so.manage")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const user = request.user!;
      const existing = await prisma.salesOrder.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งขาย" });
      }
      if (user.isBranchScoped && existing.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "ยกเลิกได้เฉพาะใบสั่งขายสาขาของตนเอง" });
      }
      try {
        const so = await cancelSalesOrder(id);
        return so;
      } catch (err) {
        if (err instanceof SoError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/quotations/:id/convert-to-so",
    {
      preHandler: [app.authenticate, app.requirePermission("so.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            branchId: { type: "integer" },
            dueDate: { type: "string" },
            deposit: { type: "integer", minimum: 0 },
            notes: { type: "string" },
            poRef: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const body = (request.body ?? {}) as {
        branchId?: number;
        dueDate?: string;
        deposit?: number;
        notes?: string;
        poRef?: string;
      };
      const user = request.user!;
      const quotation = await prisma.quotation.findUnique({ where: { id } });
      if (!quotation) {
        return reply
          .code(404)
          .send({ code: "QUOTATION_NOT_FOUND", message: "ไม่พบใบเสนอราคา" });
      }
      if (user.isBranchScoped && quotation.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "แปลงได้เฉพาะใบเสนอราคาสาขาของตนเอง" });
      }
      const branchId = body.branchId ?? quotation.branchId;
      if (user.isBranchScoped && branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "สาขาปลายทางต้องเป็นสาขาของตนเอง" });
      }
      try {
        const so = await convertQuotationToSo(id, {
          branchId,
          dueDate: parseDate(body.dueDate) ?? null,
          deposit: body.deposit,
          notes: body.notes,
          poRef: body.poRef,
          createdById: user.id,
        });
        return reply.code(201).send(so);
      } catch (err) {
        if (err instanceof SoError) {
          const code = err.code === "QUOTATION_NOT_FOUND" ? 404 : 400;
          return reply.code(code).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
