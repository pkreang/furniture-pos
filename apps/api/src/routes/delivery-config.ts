import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const VIEW = "delivery.view";
const MANAGE = "delivery.manage";

export async function deliveryConfigRoutes(app: FastifyInstance): Promise<void> {
  // --- Zones ---------------------------------------------------------------
  app.get(
    "/api/delivery/zones",
    { preHandler: [app.authenticate, app.requirePermission(VIEW)] },
    async () => prisma.deliveryZone.findMany({ orderBy: { name: "asc" } }),
  );

  app.post(
    "/api/delivery/zones",
    {
      preHandler: [app.authenticate, app.requirePermission(MANAGE)],
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1 },
            fee: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { name: string; fee?: number };
      try {
        const zone = await prisma.deliveryZone.create({
          data: { name: body.name, fee: body.fee ?? 0 },
        });
        return reply.code(201).send(zone);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ code: "DUPLICATE", message: "มีโซนชื่อนี้อยู่แล้ว" });
        }
        throw err;
      }
    },
  );

  app.patch(
    "/api/delivery/zones/:id",
    {
      preHandler: [app.authenticate, app.requirePermission(MANAGE)],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            fee: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (request) => {
      const id = Number((request.params as { id: string }).id);
      return prisma.deliveryZone.update({
        where: { id },
        data: request.body as Record<string, unknown>,
      });
    },
  );

  // --- Channels ------------------------------------------------------------
  app.get(
    "/api/delivery/channels",
    { preHandler: [app.authenticate, app.requirePermission(VIEW)] },
    async () => prisma.deliveryChannel.findMany({ orderBy: { name: "asc" } }),
  );

  app.post(
    "/api/delivery/channels",
    {
      preHandler: [app.authenticate, app.requirePermission(MANAGE)],
      schema: {
        body: {
          type: "object",
          required: ["name", "type"],
          properties: {
            name: { type: "string", minLength: 1 },
            type: { type: "string", enum: ["IN_HOUSE", "COURIER"] },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { name: string; type: "IN_HOUSE" | "COURIER" };
      try {
        const channel = await prisma.deliveryChannel.create({ data: body });
        return reply.code(201).send(channel);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ code: "DUPLICATE", message: "มีช่องทางชื่อนี้อยู่แล้ว" });
        }
        throw err;
      }
    },
  );

  // --- Teams ---------------------------------------------------------------
  app.get(
    "/api/delivery/teams",
    { preHandler: [app.authenticate, app.requirePermission(VIEW)] },
    async () =>
      prisma.deliveryTeam.findMany({
        include: { branch: { select: { name: true, code: true } } },
        orderBy: { id: "asc" },
      }),
  );

  app.post(
    "/api/delivery/teams",
    {
      preHandler: [app.authenticate, app.requirePermission(MANAGE)],
      schema: {
        body: {
          type: "object",
          required: ["name", "branchId"],
          properties: {
            name: { type: "string", minLength: 1 },
            branchId: { type: "integer" },
          },
        },
      },
    },
    async (request, reply) => {
      const team = await prisma.deliveryTeam.create({
        data: request.body as { name: string; branchId: number },
      });
      return reply.code(201).send(team);
    },
  );

  // --- Drivers -------------------------------------------------------------
  app.get(
    "/api/delivery/drivers",
    { preHandler: [app.authenticate, app.requirePermission(VIEW)] },
    async () =>
      prisma.driver.findMany({
        include: { team: { select: { name: true } } },
        orderBy: { id: "asc" },
      }),
  );

  app.post(
    "/api/delivery/drivers",
    {
      preHandler: [app.authenticate, app.requirePermission(MANAGE)],
      schema: {
        body: {
          type: "object",
          required: ["name", "teamId"],
          properties: {
            name: { type: "string", minLength: 1 },
            phone: { type: "string" },
            teamId: { type: "integer" },
          },
        },
      },
    },
    async (request, reply) => {
      const driver = await prisma.driver.create({
        data: request.body as { name: string; phone?: string; teamId: number },
      });
      return reply.code(201).send(driver);
    },
  );

  app.patch(
    "/api/delivery/drivers/:id",
    {
      preHandler: [app.authenticate, app.requirePermission(MANAGE)],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            phone: { type: "string" },
            teamId: { type: "integer" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const id = Number((request.params as { id: string }).id);
      return prisma.driver.update({
        where: { id },
        data: request.body as Record<string, unknown>,
      });
    },
  );
}
