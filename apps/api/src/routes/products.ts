import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/products",
    {
      preHandler: [app.authenticate, app.requirePermission("catalog.view")],
      schema: {
        querystring: {
          type: "object",
          properties: { categoryId: { type: "integer" } },
        },
      },
    },
    async (request) => {
      const { categoryId } = request.query as { categoryId?: number };
      return prisma.product.findMany({
        where: categoryId === undefined ? {} : { categoryId },
        include: { category: { select: { name: true } } },
        orderBy: { id: "asc" },
      });
    },
  );

  app.post(
    "/api/products",
    {
      preHandler: [app.authenticate, app.requirePermission("catalog.manage")],
      schema: {
        body: {
          type: "object",
          required: ["sku", "name", "categoryId", "basePrice"],
          properties: {
            sku: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            categoryId: { type: "integer" },
            basePrice: { type: "integer", minimum: 0 },
            isSofa: { type: "boolean" },
            imageUrl: { type: "string", nullable: true },
            size: { type: "string", nullable: true },
            material: { type: "string", nullable: true },
            color: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        sku: string;
        name: string;
        categoryId: number;
        basePrice: number;
        isSofa?: boolean;
        imageUrl?: string | null;
        size?: string | null;
        material?: string | null;
        color?: string | null;
      };
      try {
        const product = await prisma.product.create({
          data: {
            sku: body.sku,
            name: body.name,
            categoryId: body.categoryId,
            basePrice: body.basePrice,
            isSofa: body.isSofa ?? false,
            imageUrl: body.imageUrl?.trim() || null,
            size: body.size?.trim() || null,
            material: body.material?.trim() || null,
            color: body.color?.trim() || null,
          },
        });
        return reply.code(201).send(product);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ code: "DUPLICATE", message: "มีรหัสสินค้า (SKU) นี้อยู่แล้ว" });
        }
        throw err;
      }
    },
  );

  app.patch(
    "/api/products/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("catalog.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            categoryId: { type: "integer" },
            basePrice: { type: "integer", minimum: 0 },
            isSofa: { type: "boolean" },
            isActive: { type: "boolean" },
            imageUrl: { type: "string", nullable: true },
            size: { type: "string", nullable: true },
            material: { type: "string", nullable: true },
            color: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const body = request.body as Record<string, unknown>;
      const data: Record<string, unknown> = { ...body };
      // Normalise free-text fields: trim, and store null instead of "".
      for (const field of ["imageUrl", "size", "material", "color"]) {
        if (field in body) {
          const raw = body[field];
          data[field] = typeof raw === "string" ? raw.trim() || null : null;
        }
      }
      try {
        return await prisma.product.update({
          where: { id },
          data,
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ code: "DUPLICATE", message: "มีรหัสสินค้า (SKU) นี้อยู่แล้ว" });
        }
        throw err;
      }
    },
  );

  app.get(
    "/api/sofa-materials",
    { preHandler: [app.authenticate, app.requirePermission("catalog.view")] },
    async () => {
      return prisma.sofaMaterial.findMany({
        include: { colors: { orderBy: { id: "asc" } } },
        orderBy: { priceMultiplierPct: "asc" },
      });
    },
  );
}
