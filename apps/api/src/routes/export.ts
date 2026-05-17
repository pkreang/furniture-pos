import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

/**
 * Read-only data export. Returns plain JSON rows; the web app converts them to
 * `.xlsx` with SheetJS.
 */
export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/export/products",
    { preHandler: [app.authenticate, app.requirePermission("data.manage")] },
    async () => {
      const products = await prisma.product.findMany({
        include: { category: { select: { name: true } } },
        orderBy: { id: "asc" },
      });
      return products.map((p) => ({
        sku: p.sku,
        name: p.name,
        category: p.category.name,
        basePrice: p.basePrice,
        isSofa: p.isSofa,
      }));
    },
  );

  app.get(
    "/api/export/customers",
    { preHandler: [app.authenticate, app.requirePermission("data.manage")] },
    async () => {
      const customers = await prisma.customer.findMany({ orderBy: { id: "asc" } });
      return customers.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        pointsBalance: c.pointsBalance,
        lifetimeSpend: c.lifetimeSpend,
      }));
    },
  );

  app.get(
    "/api/export/stock",
    { preHandler: [app.authenticate, app.requirePermission("data.manage")] },
    async () => {
      const levels = await prisma.stockLevel.findMany({
        include: {
          product: { select: { sku: true, name: true } },
          branch: { select: { code: true } },
        },
        orderBy: [{ branchId: "asc" }, { productId: "asc" }],
      });
      return levels.map((l) => ({
        sku: l.product.sku,
        productName: l.product.name,
        branchCode: l.branch.code,
        quantity: l.quantity,
      }));
    },
  );
}
