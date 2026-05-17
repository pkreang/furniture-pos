import type { FastifyInstance } from "fastify";
import type { Prisma, DeliveryStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { createDelivery, changeDeliveryStatus, DeliveryError } from "../delivery/service.js";

const DELIVERY_STATUSES = [
  "PENDING",
  "SCHEDULED",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
] as const;

export async function deliveryRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/deliveries",
    {
      preHandler: [app.authenticate, app.requirePermission("delivery.manage")],
      schema: {
        body: {
          type: "object",
          required: ["saleId", "zoneId", "channelId", "scheduledDate", "addressText"],
          properties: {
            saleId: { type: "integer" },
            zoneId: { type: "integer" },
            channelId: { type: "integer" },
            teamId: { type: "integer" },
            driverId: { type: "integer" },
            scheduledDate: { type: "string" },
            timeSlot: { type: "string" },
            addressText: { type: "string", minLength: 1 },
            recipientName: { type: "string" },
            recipientPhone: { type: "string" },
            note: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        saleId: number;
        zoneId: number;
        channelId: number;
        teamId?: number;
        driverId?: number;
        scheduledDate: string;
        timeSlot?: string;
        addressText: string;
        recipientName?: string;
        recipientPhone?: string;
        note?: string;
      };
      const user = request.user!;
      const sale = await prisma.sale.findUnique({ where: { id: body.saleId } });
      if (!sale) {
        return reply.code(404).send({ code: "SALE_NOT_FOUND", message: "ไม่พบรายการขาย" });
      }
      if (user.isBranchScoped && sale.branchId !== user.branchId) {
        return reply
          .code(403)
          .send({ code: "BRANCH_FORBIDDEN", message: "จัดส่งได้เฉพาะบิลของสาขาตนเอง" });
      }
      try {
        const delivery = await createDelivery({
          saleId: body.saleId,
          zoneId: body.zoneId,
          channelId: body.channelId,
          teamId: body.teamId,
          driverId: body.driverId,
          scheduledDate: new Date(body.scheduledDate),
          timeSlot: body.timeSlot,
          addressText: body.addressText,
          recipientName: body.recipientName,
          recipientPhone: body.recipientPhone,
          note: body.note,
          createdById: user.id,
        });
        return reply.code(201).send(delivery);
      } catch (err) {
        if (err instanceof DeliveryError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    "/api/deliveries",
    {
      preHandler: [app.authenticate, app.requirePermission("delivery.view")],
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: [...DELIVERY_STATUSES] },
            from: { type: "string" },
            to: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const query = request.query as { status?: DeliveryStatus; from?: string; to?: string };
      const user = request.user!;
      const where: Prisma.DeliveryWhereInput = {};
      if (user.isBranchScoped && user.branchId != null) {
        where.sale = { branchId: user.branchId };
      }
      if (query.status) where.status = query.status;
      if (query.from || query.to) {
        where.scheduledDate = {};
        if (query.from) where.scheduledDate.gte = new Date(query.from);
        if (query.to) where.scheduledDate.lte = new Date(query.to);
      }
      return prisma.delivery.findMany({
        where,
        include: {
          zone: { select: { name: true } },
          channel: { select: { name: true } },
          sale: { select: { number: true } },
        },
        orderBy: { scheduledDate: "asc" },
        take: 200,
      });
    },
  );

  app.get(
    "/api/deliveries/:id",
    { preHandler: [app.authenticate, app.requirePermission("delivery.view")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const user = request.user!;
      const delivery = await prisma.delivery.findUnique({
        where: { id },
        include: {
          history: { orderBy: { id: "asc" } },
          zone: true,
          channel: true,
          team: true,
          driver: true,
          sale: { select: { number: true, branchId: true } },
        },
      });
      if (!delivery) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบงานจัดส่ง" });
      }
      if (user.isBranchScoped && delivery.sale.branchId !== user.branchId) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบงานจัดส่ง" });
      }
      return delivery;
    },
  );

  app.patch(
    "/api/deliveries/:id/status",
    {
      preHandler: [app.authenticate, app.requirePermission("delivery.manage")],
      schema: {
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: [...DELIVERY_STATUSES] },
            note: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const body = request.body as { status: DeliveryStatus; note?: string };
      const user = request.user!;
      const existing = await prisma.delivery.findUnique({
        where: { id },
        include: { sale: { select: { branchId: true } } },
      });
      if (!existing) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบงานจัดส่ง" });
      }
      if (user.isBranchScoped && existing.sale.branchId !== user.branchId) {
        return reply.code(403).send({ code: "BRANCH_FORBIDDEN", message: "ทำได้เฉพาะสาขาของตนเอง" });
      }
      try {
        return await changeDeliveryStatus(id, body.status, user.id, body.note);
      } catch (err) {
        if (err instanceof DeliveryError) {
          return reply.code(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
