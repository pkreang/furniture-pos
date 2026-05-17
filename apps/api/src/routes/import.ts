import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { applyStockMovement, StockError } from "../stock/service.js";

interface RowError {
  row: number;
  message: string;
}

interface ImportResult {
  created: number;
  errors: RowError[];
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const rowsSchema = {
  body: {
    type: "object",
    required: ["rows"],
    properties: { rows: { type: "array" } },
  },
};

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/import/products",
    {
      preHandler: [app.authenticate, app.requirePermission("data.manage")],
      schema: rowsSchema,
    },
    async (request) => {
      const { rows } = request.body as { rows: Record<string, unknown>[] };
      const result: ImportResult = { created: 0, errors: [] };
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const sku = String(row.sku ?? "").trim();
        const name = String(row.name ?? "").trim();
        const categoryName = String(row.category ?? "").trim();
        const basePrice = Number(row.basePrice);
        if (!sku || !name || !categoryName) {
          result.errors.push({ row: i + 1, message: "ต้องมี sku, name และ category" });
          continue;
        }
        if (!Number.isInteger(basePrice) || basePrice < 0) {
          result.errors.push({ row: i + 1, message: "basePrice ต้องเป็นจำนวนเต็มไม่ติดลบ" });
          continue;
        }
        try {
          const category = await prisma.category.upsert({
            where: { name: categoryName },
            update: {},
            create: { name: categoryName },
          });
          await prisma.product.create({
            data: {
              sku,
              name,
              categoryId: category.id,
              basePrice,
              isSofa: row.isSofa === true || row.isSofa === "true",
            },
          });
          result.created += 1;
        } catch (err) {
          result.errors.push({
            row: i + 1,
            message: isUniqueViolation(err) ? `มีรหัสสินค้า ${sku} อยู่แล้ว` : "บันทึกไม่สำเร็จ",
          });
        }
      }
      return result;
    },
  );

  app.post(
    "/api/import/customers",
    {
      preHandler: [app.authenticate, app.requirePermission("data.manage")],
      schema: rowsSchema,
    },
    async (request) => {
      const { rows } = request.body as { rows: Record<string, unknown>[] };
      const result: ImportResult = { created: 0, errors: [] };
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row.name ?? "").trim();
        const phone = String(row.phone ?? "").trim();
        if (!name || !phone) {
          result.errors.push({ row: i + 1, message: "ต้องมี name และ phone" });
          continue;
        }
        try {
          await prisma.customer.create({
            data: { name, phone, email: row.email ? String(row.email) : null },
          });
          result.created += 1;
        } catch (err) {
          result.errors.push({
            row: i + 1,
            message: isUniqueViolation(err) ? `มีลูกค้าเบอร์ ${phone} อยู่แล้ว` : "บันทึกไม่สำเร็จ",
          });
        }
      }
      return result;
    },
  );

  app.post(
    "/api/import/stock",
    {
      preHandler: [app.authenticate, app.requirePermission("data.manage")],
      schema: rowsSchema,
    },
    async (request) => {
      const { rows } = request.body as { rows: Record<string, unknown>[] };
      const userId = request.user!.id;
      const result: ImportResult = { created: 0, errors: [] };
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const sku = String(row.sku ?? "").trim();
        const branchCode = String(row.branchCode ?? "").trim();
        const quantity = Number(row.quantity);
        if (!sku || !branchCode) {
          result.errors.push({ row: i + 1, message: "ต้องมี sku และ branchCode" });
          continue;
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
          result.errors.push({ row: i + 1, message: "quantity ต้องเป็นจำนวนเต็มบวก" });
          continue;
        }
        const product = await prisma.product.findUnique({ where: { sku } });
        const branch = await prisma.branch.findUnique({ where: { code: branchCode } });
        if (!product || !branch) {
          result.errors.push({ row: i + 1, message: `ไม่พบสินค้า/สาขา (${sku} / ${branchCode})` });
          continue;
        }
        try {
          await prisma.$transaction((tx) =>
            applyStockMovement(tx, {
              productId: product.id,
              branchId: branch.id,
              delta: quantity,
              reason: "IMPORT",
              userId,
            }),
          );
          result.created += 1;
        } catch (err) {
          result.errors.push({
            row: i + 1,
            message: err instanceof StockError ? err.message : "นำเข้าสต็อกไม่สำเร็จ",
          });
        }
      }
      return result;
    },
  );
}
