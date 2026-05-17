import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/categories",
    { preHandler: [app.authenticate, app.requirePermission("catalog.view")] },
    async () => {
      return prisma.category.findMany({ orderBy: { name: "asc" } });
    },
  );

  app.post(
    "/api/categories",
    {
      preHandler: [app.authenticate, app.requirePermission("catalog.manage")],
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body as { name: string };
      try {
        const category = await prisma.category.create({ data: { name } });
        return reply.code(201).send(category);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ code: "DUPLICATE", message: "มีหมวดหมู่ชื่อนี้อยู่แล้ว" });
        }
        throw err;
      }
    },
  );

  app.patch(
    "/api/categories/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("catalog.manage")],
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      try {
        return await prisma.category.update({
          where: { id },
          data: request.body as { name: string },
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ code: "DUPLICATE", message: "มีหมวดหมู่ชื่อนี้อยู่แล้ว" });
        }
        throw err;
      }
    },
  );
}
