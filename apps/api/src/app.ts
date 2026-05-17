import Fastify, { type FastifyInstance } from "fastify";
import { branchRoutes } from "./routes/branches.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(branchRoutes);

  return app;
}
