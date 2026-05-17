import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { APP_SETTINGS } from "../seed/catalog.js";

const ALLOWED_KEYS = new Set(Object.keys(APP_SETTINGS));

async function settingsMap(): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/settings", { preHandler: [app.authenticate] }, async () => settingsMap());

  app.put(
    "/api/settings",
    { preHandler: [app.authenticate, app.requirePermission("settings.manage")] },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const entries = Object.entries(body);
      for (const [key] of entries) {
        if (!ALLOWED_KEYS.has(key)) {
          return reply.code(400).send({ code: "UNKNOWN_KEY", message: `ไม่รู้จักการตั้งค่า: ${key}` });
        }
      }
      for (const [key, value] of entries) {
        await prisma.appSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }
      return settingsMap();
    },
  );
}
