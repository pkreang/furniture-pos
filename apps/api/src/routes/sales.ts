import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { branchFilter } from "../auth/branch-scope.js";
import { checkout, CheckoutError } from "../sales/checkout.js";
import { StockError } from "../stock/service.js";
import { PointError } from "../membership/points.js";

interface CheckoutBody {
  branchId: number;
  customerId?: number;
  items: { productId: number; quantity: number }[];
  payments: { method: "CASH" | "TRANSFER" | "CARD"; amount: number }[];
  discountPercent?: number;
  redeemPoints?: number;
}

export async function saleRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/sales",
    {
      preHandler: [app.authenticate, app.requirePermission("sales.create")],
      schema: {
        body: {
          type: "object",
          required: ["branchId", "items", "payments"],
          properties: {
            branchId: { type: "integer" },
            customerId: { type: "integer" },
            discountPercent: { type: "number", minimum: 0, maximum: 100 },
            redeemPoints: { type: "integer", minimum: 0 },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: { type: "integer" },
                  quantity: { type: "integer", minimum: 1 },
                },
              },
            },
            payments: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["method", "amount"],
                properties: {
                  method: { type: "string", enum: ["CASH", "TRANSFER", "CARD"] },
                  amount: { type: "integer", minimum: 0 },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CheckoutBody;
      const user = request.user!;
      if (user.isBranchScoped && body.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "ขายได้เฉพาะสาขาของตนเอง" });
      }
      try {
        const sale = await checkout({
          branchId: body.branchId,
          cashierId: user.id,
          customerId: body.customerId,
          items: body.items,
          payments: body.payments,
          discountPercent: body.discountPercent,
          redeemPoints: body.redeemPoints,
          maxDiscountPercent: user.discountMaxPercent,
        });
        return reply.code(201).send(sale);
      } catch (err) {
        if (err instanceof CheckoutError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        if (err instanceof StockError) {
          return reply.code(400).send({ code: "INSUFFICIENT_STOCK", message: err.message });
        }
        if (err instanceof PointError) {
          return reply.code(400).send({ code: "INSUFFICIENT_POINTS", message: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    "/api/sales",
    { preHandler: [app.authenticate, app.requirePermission("sales.view")] },
    async (request) => {
      return prisma.sale.findMany({
        where: branchFilter(request.user!),
        include: {
          branch: { select: { name: true, code: true } },
          customer: { select: { name: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { id: "desc" },
        take: 100,
      });
    },
  );

  app.get(
    "/api/sales/:id",
    { preHandler: [app.authenticate, app.requirePermission("sales.view")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const sale = await prisma.sale.findFirst({
        where: { id, ...branchFilter(request.user!) },
        include: {
          items: true,
          payments: true,
          taxInvoice: true,
          branch: { select: { name: true, code: true } },
          customer: true,
          cashier: { select: { name: true, username: true } },
        },
      });
      if (!sale) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบรายการขาย" });
      }
      return sale;
    },
  );
}
