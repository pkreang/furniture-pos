import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { getTier } from "../membership/tiers.js";

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/customers",
    {
      preHandler: [app.authenticate, app.requirePermission("customers.view")],
      schema: {
        querystring: {
          type: "object",
          properties: { q: { type: "string" } },
        },
      },
    },
    async (request) => {
      const { q } = request.query as { q?: string };
      const where: Prisma.CustomerWhereInput =
        q && q.length > 0
          ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
          : {};
      const customers = await prisma.customer.findMany({ where, orderBy: { id: "asc" } });
      return customers.map((c) => ({ ...c, tier: getTier(c.lifetimeSpend) }));
    },
  );

  app.get(
    "/api/customers/:id",
    { preHandler: [app.authenticate, app.requirePermission("customers.view")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: { pointTransactions: { orderBy: { id: "desc" }, take: 50 } },
      });
      if (!customer) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบลูกค้า" });
      }
      return { ...customer, tier: getTier(customer.lifetimeSpend) };
    },
  );

  app.post(
    "/api/customers",
    {
      preHandler: [app.authenticate, app.requirePermission("customers.manage")],
      schema: {
        body: {
          type: "object",
          required: ["name", "phone"],
          properties: {
            name: { type: "string", minLength: 1 },
            phone: { type: "string", minLength: 1 },
            email: { type: "string" },
            taxId: { type: "string" },
            taxName: { type: "string" },
            taxAddress: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const customer = await prisma.customer.create({
          data: request.body as Prisma.CustomerCreateInput,
        });
        return reply.code(201).send(customer);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ code: "DUPLICATE", message: "มีลูกค้าเบอร์นี้อยู่แล้ว" });
        }
        throw err;
      }
    },
  );

  app.patch(
    "/api/customers/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("customers.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            email: { type: "string" },
            taxId: { type: "string" },
            taxName: { type: "string" },
            taxAddress: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const id = Number((request.params as { id: string }).id);
      return prisma.customer.update({
        where: { id },
        data: request.body as Prisma.CustomerUpdateInput,
      });
    },
  );
}
