import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { branchFilter } from "../auth/branch-scope.js";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  confirmPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  POError,
} from "../procurement/po.js";
import { StockError } from "../stock/service.js";

const PO_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "FULLY_RECEIVED",
  "CANCELLED",
] as const;

const poItemSchema = {
  type: "object",
  required: ["productId", "orderedQty", "unitCost"],
  properties: {
    productId: { type: "integer" },
    orderedQty: { type: "integer", minimum: 1 },
    unitCost: { type: "integer", minimum: 0 },
  },
};

const poBodySchema = {
  type: "object",
  required: ["supplierId", "branchId", "items"],
  properties: {
    supplierId: { type: "integer" },
    branchId: { type: "integer" },
    expectedDate: { type: "string" },
    notes: { type: "string" },
    items: { type: "array", minItems: 1, items: poItemSchema },
  },
};

const poPatchSchema = {
  type: "object",
  required: ["items"],
  properties: {
    supplierId: { type: "integer" },
    branchId: { type: "integer" },
    expectedDate: { type: "string" },
    notes: { type: "string" },
    items: { type: "array", minItems: 1, items: poItemSchema },
  },
};

interface PoBody {
  supplierId: number;
  branchId: number;
  expectedDate?: string;
  notes?: string;
  items: { productId: number; orderedQty: number; unitCost: number }[];
}

function parseDate(input: string | undefined): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === "") return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export async function purchaseOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/purchase-orders",
    {
      preHandler: [app.authenticate, app.requirePermission("po.view")],
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            supplierId: { type: "string" },
            branchId: { type: "string" },
            q: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { status, supplierId, branchId, q } = request.query as {
        status?: string;
        supplierId?: string;
        branchId?: string;
        q?: string;
      };
      const where: Prisma.PurchaseOrderWhereInput = { ...branchFilter(request.user!) };
      if (status && (PO_STATUSES as readonly string[]).includes(status)) {
        where.status = status as (typeof PO_STATUSES)[number];
      }
      if (supplierId) {
        const id = Number(supplierId);
        if (!Number.isNaN(id)) where.supplierId = id;
      }
      if (branchId && !request.user!.isBranchScoped) {
        const id = Number(branchId);
        if (!Number.isNaN(id)) where.branchId = id;
      }
      if (q && q.length > 0) {
        where.code = { contains: q };
      }
      return prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { id: "desc" },
        take: 200,
      });
    },
  );

  app.get(
    "/api/purchase-orders/:id",
    { preHandler: [app.authenticate, app.requirePermission("po.view")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const po = await prisma.purchaseOrder.findFirst({
        where: { id, ...branchFilter(request.user!) },
        include: {
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
          supplier: true,
          branch: true,
        },
      });
      if (!po) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งซื้อ" });
      }
      return po;
    },
  );

  app.post(
    "/api/purchase-orders",
    {
      preHandler: [app.authenticate, app.requirePermission("po.manage")],
      schema: { body: poBodySchema },
    },
    async (request, reply) => {
      const body = request.body as PoBody;
      const user = request.user!;
      if (user.isBranchScoped && body.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "สร้างใบสั่งซื้อได้เฉพาะสาขาของตนเอง" });
      }
      try {
        const po = await createPurchaseOrder({
          supplierId: body.supplierId,
          branchId: body.branchId,
          createdById: user.id,
          expectedDate: parseDate(body.expectedDate) ?? null,
          notes: body.notes,
          items: body.items,
        });
        return reply.code(201).send(po);
      } catch (err) {
        if (err instanceof POError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.patch(
    "/api/purchase-orders/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("po.manage")],
      schema: { body: poPatchSchema },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const body = request.body as PoBody;
      const user = request.user!;
      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งซื้อ" });
      }
      if (user.isBranchScoped && existing.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "แก้ไขได้เฉพาะใบสั่งซื้อสาขาของตนเอง" });
      }
      if (user.isBranchScoped && body.branchId !== undefined && body.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "สาขาปลายทางต้องเป็นสาขาของตนเอง" });
      }
      try {
        const po = await updatePurchaseOrder(id, {
          supplierId: body.supplierId,
          branchId: body.branchId,
          expectedDate: parseDate(body.expectedDate),
          notes: body.notes,
          items: body.items,
        });
        return po;
      } catch (err) {
        if (err instanceof POError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/purchase-orders/:id/confirm",
    { preHandler: [app.authenticate, app.requirePermission("po.manage")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const user = request.user!;
      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งซื้อ" });
      }
      if (user.isBranchScoped && existing.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "ยืนยันได้เฉพาะใบสั่งซื้อสาขาของตนเอง" });
      }
      try {
        const po = await confirmPurchaseOrder(id);
        return po;
      } catch (err) {
        if (err instanceof POError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/purchase-orders/:id/receive",
    {
      preHandler: [app.authenticate, app.requirePermission("po.receive")],
      schema: {
        body: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["itemId", "qty"],
                properties: {
                  itemId: { type: "integer" },
                  qty: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const body = request.body as { items: { itemId: number; qty: number }[] };
      const user = request.user!;
      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งซื้อ" });
      }
      if (user.isBranchScoped && existing.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "รับของได้เฉพาะใบสั่งซื้อสาขาของตนเอง" });
      }
      try {
        const po = await receivePurchaseOrder(id, { items: body.items, userId: user.id });
        return po;
      } catch (err) {
        if (err instanceof POError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        if (err instanceof StockError) {
          return reply.code(400).send({ code: "STOCK_ERROR", message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/purchase-orders/:id/cancel",
    { preHandler: [app.authenticate, app.requirePermission("po.manage")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const user = request.user!;
      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบสั่งซื้อ" });
      }
      if (user.isBranchScoped && existing.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "ยกเลิกได้เฉพาะใบสั่งซื้อสาขาของตนเอง" });
      }
      try {
        const po = await cancelPurchaseOrder(id);
        return po;
      } catch (err) {
        if (err instanceof POError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
