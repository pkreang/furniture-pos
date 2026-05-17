import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function branchRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/branches",
    { preHandler: [app.authenticate, app.requirePermission("branches.view")] },
    async () => {
      return prisma.branch.findMany({ orderBy: { id: "asc" } });
    },
  );

  app.post(
    "/api/branches",
    {
      preHandler: [app.authenticate, app.requirePermission("branches.manage")],
      schema: {
        body: {
          type: "object",
          required: ["name", "code"],
          properties: {
            name: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 1 },
            isWarehouse: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { name: string; code: string; isWarehouse?: boolean };
      const branch = await prisma.branch.create({
        data: { name: body.name, code: body.code, isWarehouse: body.isWarehouse ?? false },
      });
      return reply.code(201).send(branch);
    },
  );

  app.patch(
    "/api/branches/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("branches.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 1 },
            isWarehouse: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const id = Number((request.params as { id: string }).id);
      return prisma.branch.update({
        where: { id },
        data: request.body as Record<string, unknown>,
      });
    },
  );
}
