import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export async function supplierRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/suppliers",
    {
      preHandler: [app.authenticate, app.requirePermission("suppliers.view")],
      schema: {
        querystring: {
          type: "object",
          properties: {
            q: { type: "string" },
            active: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { q, active } = request.query as { q?: string; active?: string };
      const where: Prisma.SupplierWhereInput = {};
      if (q && q.length > 0) {
        where.OR = [{ name: { contains: q } }, { phone: { contains: q } }];
      }
      if (active === "true") {
        where.isActive = true;
      } else if (active === "false") {
        where.isActive = false;
      } else {
        where.isActive = true;
      }
      return prisma.supplier.findMany({ where, orderBy: { id: "asc" } });
    },
  );

  app.get(
    "/api/suppliers/:id",
    { preHandler: [app.authenticate, app.requirePermission("suppliers.view")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const supplier = await prisma.supplier.findUnique({ where: { id } });
      if (!supplier) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบซัพพลายเออร์" });
      }
      return supplier;
    },
  );

  app.post(
    "/api/suppliers",
    {
      preHandler: [app.authenticate, app.requirePermission("suppliers.manage")],
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1 },
            contactName: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            address: { type: "string" },
            taxId: { type: "string" },
            notes: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const supplier = await prisma.supplier.create({
        data: request.body as Prisma.SupplierCreateInput,
      });
      return reply.code(201).send(supplier);
    },
  );

  app.patch(
    "/api/suppliers/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("suppliers.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            contactName: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            address: { type: "string" },
            taxId: { type: "string" },
            notes: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      try {
        return await prisma.supplier.update({
          where: { id },
          data: request.body as Prisma.SupplierUpdateInput,
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบซัพพลายเออร์" });
        }
        throw err;
      }
    },
  );

  app.delete(
    "/api/suppliers/:id",
    { preHandler: [app.authenticate, app.requirePermission("suppliers.manage")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      try {
        await prisma.supplier.update({ where: { id }, data: { isActive: false } });
        return { ok: true };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบซัพพลายเออร์" });
        }
        throw err;
      }
    },
  );
}
