import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "../prisma.js";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Records one `audit_log` row after every successful mutating request — who,
 * which route, and the status. Runs in `onResponse` (after the reply is sent),
 * and an audit-write failure never affects the response. Request bodies are
 * never logged, so credentials never reach the log.
 */
async function auditPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onResponse", async (request, reply) => {
    if (!MUTATING.has(request.method) || reply.statusCode >= 400) return;
    try {
      await prisma.auditLog.create({
        data: {
          userId: request.user?.id ?? null,
          method: request.method,
          path: request.routeOptions?.url ?? request.url,
          statusCode: reply.statusCode,
        },
      });
    } catch (err) {
      console.error("audit log write failed:", err);
    }
  });
}

export default fp(auditPlugin);
