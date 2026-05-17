import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/audit-log",
    { preHandler: [app.authenticate, app.requirePermission("audit.view")] },
    async () => {
      return prisma.auditLog.findMany({
        include: { user: { select: { username: true, name: true } } },
        orderBy: { id: "desc" },
        take: 200,
      });
    },
  );
}
