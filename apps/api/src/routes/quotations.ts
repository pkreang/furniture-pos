import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { branchFilter } from "../auth/branch-scope.js";
import { createQuotation, convertQuotation, QuotationError } from "../sales/quotation.js";
import { CheckoutError } from "../sales/checkout.js";
import { StockError } from "../stock/service.js";
import { PointError } from "../membership/points.js";

export async function quotationRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/quotations",
    {
      preHandler: [app.authenticate, app.requirePermission("quotations.manage")],
      schema: {
        body: {
          type: "object",
          required: ["branchId", "items"],
          properties: {
            branchId: { type: "integer" },
            customerId: { type: "integer" },
            note: { type: "string" },
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
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        branchId: number;
        customerId?: number;
        note?: string;
        items: { productId: number; quantity: number }[];
      };
      const user = request.user!;
      if (user.isBranchScoped && body.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "สร้างใบเสนอราคาได้เฉพาะสาขาของตนเอง" });
      }
      try {
        const quotation = await createQuotation({
          branchId: body.branchId,
          createdById: user.id,
          customerId: body.customerId,
          note: body.note,
          items: body.items,
        });
        return reply.code(201).send(quotation);
      } catch (err) {
        if (err instanceof QuotationError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    "/api/quotations",
    { preHandler: [app.authenticate, app.requirePermission("quotations.view")] },
    async (request) => {
      return prisma.quotation.findMany({
        where: branchFilter(request.user!),
        include: {
          branch: { select: { name: true, code: true } },
          customer: { select: { name: true, phone: true } },
        },
        orderBy: { id: "desc" },
        take: 100,
      });
    },
  );

  app.get(
    "/api/quotations/:id",
    { preHandler: [app.authenticate, app.requirePermission("quotations.view")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const quotation = await prisma.quotation.findFirst({
        where: { id, ...branchFilter(request.user!) },
        include: {
          items: true,
          branch: { select: { name: true, code: true } },
          customer: true,
        },
      });
      if (!quotation) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบเสนอราคา" });
      }
      return quotation;
    },
  );

  app.post(
    "/api/quotations/:id/convert",
    {
      preHandler: [app.authenticate, app.requirePermission("quotations.manage")],
      schema: {
        body: {
          type: "object",
          required: ["payments"],
          properties: {
            discountPercent: { type: "number", minimum: 0, maximum: 100 },
            redeemPoints: { type: "integer", minimum: 0 },
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
      const id = Number((request.params as { id: string }).id);
      const body = request.body as {
        payments: { method: "CASH" | "TRANSFER" | "CARD"; amount: number }[];
        discountPercent?: number;
        redeemPoints?: number;
      };
      const user = request.user!;
      const quotation = await prisma.quotation.findUnique({ where: { id } });
      if (!quotation) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบใบเสนอราคา" });
      }
      if (user.isBranchScoped && quotation.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "แปลงใบเสนอราคาได้เฉพาะสาขาของตนเอง" });
      }
      try {
        const sale = await convertQuotation({
          quotationId: id,
          cashierId: user.id,
          payments: body.payments,
          discountPercent: body.discountPercent,
          redeemPoints: body.redeemPoints,
          maxDiscountPercent: user.discountMaxPercent,
        });
        return reply.code(201).send(sale);
      } catch (err) {
        if (
          err instanceof QuotationError ||
          err instanceof CheckoutError
        ) {
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
}
