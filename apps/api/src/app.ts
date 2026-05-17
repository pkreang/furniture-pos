import Fastify, { type FastifyInstance } from "fastify";
import authPlugin from "./auth/plugin.js";
import { authRoutes } from "./auth/routes.js";
import { branchRoutes } from "./routes/branches.js";
import { userRoutes } from "./routes/users.js";
import { roleRoutes } from "./routes/roles.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(branchRoutes);
  app.register(userRoutes);
  app.register(roleRoutes);

  return app;
}
