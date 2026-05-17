import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { branchFilter } from "../auth/branch-scope.js";
import { generateZReport, ZReportError } from "../reports/zreport.js";

const LOW_STOCK_THRESHOLD = 5;

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/z-reports",
    {
      preHandler: [app.authenticate, app.requirePermission("reports.generate")],
      schema: {
        body: {
          type: "object",
          required: ["branchId", "businessDate"],
          properties: {
            branchId: { type: "integer" },
            businessDate: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { branchId: number; businessDate: string };
      const user = request.user!;
      if (user.isBranchScoped && body.branchId !== user.branchId) {
        return reply.code(403).send({ code: "BRANCH_FORBIDDEN", message: "ออกได้เฉพาะสาขาของตนเอง" });
      }
      try {
        const z = await generateZReport(prisma, {
          branchId: body.branchId,
          businessDate: new Date(body.businessDate),
          generatedById: user.id,
        });
        return reply.code(201).send(z);
      } catch (err) {
        if (err instanceof ZReportError) {
          return reply.code(409).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    "/api/z-reports",
    { preHandler: [app.authenticate, app.requirePermission("reports.view")] },
    async (request) => {
      return prisma.zReport.findMany({
        where: branchFilter(request.user!),
        include: { branch: { select: { name: true, code: true } } },
        orderBy: { id: "desc" },
        take: 100,
      });
    },
  );

  app.get(
    "/api/z-reports/:id",
    { preHandler: [app.authenticate, app.requirePermission("reports.view")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const z = await prisma.zReport.findFirst({
        where: { id, ...branchFilter(request.user!) },
        include: { branch: { select: { name: true, code: true } } },
      });
      if (!z) return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบรายงาน" });
      return z;
    },
  );

  app.get(
    "/api/dashboard",
    { preHandler: [app.authenticate, app.requirePermission("reports.view")] },
    async (request) => {
      const user = request.user!;
      const scoped = branchFilter(user);
      const now = new Date();
      const dayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );

      const today = await prisma.sale.aggregate({
        where: { ...scoped, status: "COMPLETED", createdAt: { gte: dayStart } },
        _count: true,
        _sum: { total: true },
      });
      const outstanding = await prisma.sale.aggregate({
        where: { ...scoped, status: "COMPLETED", outstanding: { gt: 0 } },
        _sum: { outstanding: true },
      });
      const deliveryWhere: Prisma.DeliveryWhereInput = {
        status: { in: ["PENDING", "SCHEDULED", "IN_TRANSIT"] },
      };
      if (user.isBranchScoped && user.branchId != null) {
        deliveryWhere.sale = { branchId: user.branchId };
      }
      const pendingDeliveries = await prisma.delivery.count({ where: deliveryWhere });
      const lowStockCount = await prisma.stockLevel.count({
        where: { ...scoped, quantity: { lt: LOW_STOCK_THRESHOLD } },
      });

      return {
        todaySalesCount: today._count,
        todaySalesTotal: today._sum.total ?? 0,
        outstandingTotal: outstanding._sum.outstanding ?? 0,
        pendingDeliveries,
        lowStockCount,
      };
    },
  );
}
