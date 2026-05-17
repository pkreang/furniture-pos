import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { runDailyReport } from "../reports/daily.js";

export async function dailyReportRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/daily-report/run",
    { preHandler: [app.authenticate, app.requirePermission("reports.generate")] },
    async () => {
      return runDailyReport(prisma, new Date());
    },
  );

  app.get(
    "/api/daily-report/history",
    { preHandler: [app.authenticate, app.requirePermission("reports.view")] },
    async () => {
      return prisma.dailyReportHistory.findMany({ orderBy: { id: "desc" }, take: 50 });
    },
  );
}
