import Fastify, { type FastifyInstance } from "fastify";
import authPlugin from "./auth/plugin.js";
import { authRoutes } from "./auth/routes.js";
import { branchRoutes } from "./routes/branches.js";
import { userRoutes } from "./routes/users.js";
import { roleRoutes } from "./routes/roles.js";
import { categoryRoutes } from "./routes/categories.js";
import { productRoutes } from "./routes/products.js";
import { stockRoutes } from "./routes/stock.js";
import { transferRoutes } from "./routes/transfers.js";
import { customerRoutes } from "./routes/customers.js";
import { saleRoutes } from "./routes/sales.js";
import { quotationRoutes } from "./routes/quotations.js";
import { settingsRoutes } from "./routes/settings.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(branchRoutes);
  app.register(userRoutes);
  app.register(roleRoutes);
  app.register(categoryRoutes);
  app.register(productRoutes);
  app.register(stockRoutes);
  app.register(transferRoutes);
  app.register(customerRoutes);
  app.register(saleRoutes);
  app.register(quotationRoutes);
  app.register(settingsRoutes);

  return app;
}
