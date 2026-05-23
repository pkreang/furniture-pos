import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import { registerErrorHandlers } from "./errors.js";
import authPlugin from "./auth/plugin.js";
import auditPlugin from "./audit/plugin.js";
import { authRoutes } from "./auth/routes.js";
import { branchRoutes } from "./routes/branches.js";
import { userRoutes } from "./routes/users.js";
import { roleRoutes } from "./routes/roles.js";
import { categoryRoutes } from "./routes/categories.js";
import { productRoutes } from "./routes/products.js";
import { stockRoutes } from "./routes/stock.js";
import { transferRoutes } from "./routes/transfers.js";
import { customerRoutes } from "./routes/customers.js";
import { supplierRoutes } from "./routes/suppliers.js";
import { purchaseOrderRoutes } from "./routes/purchase-orders.js";
import { salesOrderRoutes } from "./routes/sales-orders.js";
import { saleRoutes } from "./routes/sales.js";
import { quotationRoutes } from "./routes/quotations.js";
import { deliveryConfigRoutes } from "./routes/delivery-config.js";
import { deliveryRoutes } from "./routes/deliveries.js";
import { reportRoutes } from "./routes/reports.js";
import { dailyReportRoutes } from "./routes/daily-report.js";
import { eventRoutes } from "./routes/events.js";
import { auditRoutes } from "./routes/audit.js";
import { exportRoutes } from "./routes/export.js";
import { importRoutes } from "./routes/import.js";
import { settingsRoutes } from "./routes/settings.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  registerErrorHandlers(app);
  app.register(helmet);

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authPlugin);
  app.register(auditPlugin);
  app.register(authRoutes);
  app.register(branchRoutes);
  app.register(userRoutes);
  app.register(roleRoutes);
  app.register(categoryRoutes);
  app.register(productRoutes);
  app.register(stockRoutes);
  app.register(transferRoutes);
  app.register(customerRoutes);
  app.register(supplierRoutes);
  app.register(purchaseOrderRoutes);
  app.register(salesOrderRoutes);
  app.register(saleRoutes);
  app.register(quotationRoutes);
  app.register(deliveryConfigRoutes);
  app.register(deliveryRoutes);
  app.register(reportRoutes);
  app.register(dailyReportRoutes);
  app.register(eventRoutes);
  app.register(auditRoutes);
  app.register(exportRoutes);
  app.register(importRoutes);
  app.register(settingsRoutes);

  return app;
}
