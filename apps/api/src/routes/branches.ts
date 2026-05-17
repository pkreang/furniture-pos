import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function branchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/branches", async () => {
    return prisma.branch.findMany({ orderBy: { code: "asc" } });
  });
}
