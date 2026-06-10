import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { branchFilter } from "../auth/branch-scope.js";
import { applyStockMovement, StockError } from "../stock/service.js";
import { emitAppEvent } from "../events/bus.js";

export async function stockRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/stock",
    {
      preHandler: [app.authenticate, app.requirePermission("stock.view")],
      schema: {
        querystring: {
          type: "object",
          properties: { branchId: { type: "integer" } },
        },
      },
    },
    async (request) => {
      const scoped = branchFilter(request.user!);
      const { branchId } = request.query as { branchId?: number };
      const where = scoped.branchId !== undefined ? scoped : branchId !== undefined ? { branchId } : {};
      const levels = await prisma.stockLevel.findMany({
        where,
        include: {
          product: {
            select: {
              sku: true,
              name: true,
              size: true,
              material: true,
              color: true,
              imageUrl: true,
            },
          },
          branch: { select: { name: true, code: true } },
        },
        orderBy: [{ branchId: "asc" }, { productId: "asc" }],
      });
      return levels.map((l) => ({
        productId: l.productId,
        branchId: l.branchId,
        quantity: l.quantity,
        reservedQty: l.reservedQty,
        available: l.quantity - l.reservedQty,
        product: l.product,
        branch: l.branch,
      }));
    },
  );

  app.post(
    "/api/stock/adjust",
    {
      preHandler: [app.authenticate, app.requirePermission("stock.adjust")],
      schema: {
        body: {
          type: "object",
          required: ["productId", "branchId", "delta"],
          properties: {
            productId: { type: "integer" },
            branchId: { type: "integer" },
            delta: { type: "integer" },
            note: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { productId: number; branchId: number; delta: number; note?: string };
      const user = request.user!;
      if (user.isBranchScoped && body.branchId !== user.branchId) {
        return reply.code(403).send({ code: "BRANCH_FORBIDDEN", message: "ปรับสต็อกได้เฉพาะสาขาของตนเอง" });
      }
      if (body.delta === 0) {
        return reply.code(400).send({ code: "INVALID_DELTA", message: "จำนวนที่ปรับต้องไม่เป็นศูนย์" });
      }
      try {
        const quantity = await prisma.$transaction((tx) =>
          applyStockMovement(tx, {
            productId: body.productId,
            branchId: body.branchId,
            delta: body.delta,
            reason: "ADJUST",
            note: body.note,
            userId: user.id,
          }),
        );
        emitAppEvent({ type: "stock.changed", payload: { branchId: body.branchId } });
        return { productId: body.productId, branchId: body.branchId, quantity };
      } catch (err) {
        if (err instanceof StockError) {
          return reply.code(400).send({ code: "INSUFFICIENT_STOCK", message: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    "/api/stock/movements",
    { preHandler: [app.authenticate, app.requirePermission("stock.view")] },
    async (request) => {
      return prisma.stockMovement.findMany({
        where: branchFilter(request.user!),
        include: {
          product: { select: { sku: true, name: true } },
          branch: { select: { name: true, code: true } },
        },
        orderBy: { id: "desc" },
        take: 100,
      });
    },
  );
}
