import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/settings",
    { preHandler: [app.authenticate] },
    async () => {
      const rows = await prisma.appSetting.findMany();
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
  );
}
