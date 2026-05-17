import type { FastifyInstance } from "fastify";
import { onAppEvent } from "../events/bus.js";

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/events", { preHandler: [app.authenticate] }, async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write(": connected\n\n");

    const off = onAppEvent((event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    request.raw.on("close", off);

    // Keep the request open; Fastify must not send its own response.
    return reply;
  });
}
