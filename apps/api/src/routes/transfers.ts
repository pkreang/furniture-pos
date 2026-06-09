import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { transferStock, StockError } from "../stock/service.js";
import { emitAppEvent } from "../events/bus.js";

export async function transferRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/transfers",
    { preHandler: [app.authenticate, app.requirePermission("stock.view")] },
    async (request) => {
      const user = request.user!;
      const where: Prisma.TransferWhereInput =
        user.isBranchScoped && user.branchId != null
          ? { OR: [{ fromBranchId: user.branchId }, { toBranchId: user.branchId }] }
          : {};
      return prisma.transfer.findMany({
        where,
        include: {
          product: {
            select: {
              sku: true,
              name: true,
              size: true,
              material: true,
              color: true,
            },
          },
          fromBranch: { select: { name: true, code: true } },
          toBranch: { select: { name: true, code: true } },
        },
        orderBy: { id: "desc" },
        take: 100,
      });
    },
  );

  app.post(
    "/api/transfers",
    {
      preHandler: [app.authenticate, app.requirePermission("stock.adjust")],
      schema: {
        body: {
          type: "object",
          required: ["productId", "fromBranchId", "toBranchId", "quantity"],
          properties: {
            productId: { type: "integer" },
            fromBranchId: { type: "integer" },
            toBranchId: { type: "integer" },
            quantity: { type: "integer", minimum: 1 },
            note: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        productId: number;
        fromBranchId: number;
        toBranchId: number;
        quantity: number;
        note?: string;
      };
      const user = request.user!;
      if (user.isBranchScoped && body.fromBranchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "โอนสินค้าออกได้เฉพาะจากสาขาของตนเอง" });
      }
      try {
        const transfer = await transferStock({ ...body, userId: user.id });
        emitAppEvent({ type: "stock.changed", payload: { transferId: transfer.id } });
        return reply.code(201).send(transfer);
      } catch (err) {
        if (err instanceof StockError) {
          return reply.code(400).send({ code: "INSUFFICIENT_STOCK", message: err.message });
        }
        throw err;
      }
    },
  );
}
