import type { FastifyInstance } from "fastify";

/**
 * Installs the structured error and not-found handlers so every failure path
 * returns the same `{ code, message }` shape used by the route handlers, and a
 * 500 never leaks an internal stack trace to the client.
 */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ code: "NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" });
  });

  app.setErrorHandler((err, request, reply) => {
    if (err.validation) {
      return reply.code(400).send({ code: "VALIDATION", message: err.message });
    }
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      request.log.error(err);
      console.error(err);
      return reply.code(500).send({ code: "INTERNAL", message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
    return reply.code(status).send({ code: err.code ?? "ERROR", message: err.message });
  });
}
