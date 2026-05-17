import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { verifyPassword, hashPassword } from "./password.js";
import { createSession, revokeSession } from "./session.js";
import { SESSION_COOKIE } from "./plugin.js";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/auth/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body as { username: string; password: string };
      const user = await prisma.user.findUnique({ where: { username } });
      const ok = user && user.isActive && (await verifyPassword(user.passwordHash, password));
      if (!user || !ok) {
        return reply
          .code(401)
          .send({ code: "INVALID_CREDENTIALS", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }
      const token = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
      return { id: user.id, username: user.username, name: user.name, mustChangePassword: user.mustChangePassword };
    },
  );

  app.post("/api/auth/logout", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.sessionToken) await revokeSession(request.sessionToken);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    return request.user;
  });

  app.post(
    "/api/auth/change-password",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 1 },
            newPassword: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.id } });
      if (!(await verifyPassword(user.passwordHash, currentPassword))) {
        return reply
          .code(400)
          .send({ code: "INVALID_CREDENTIALS", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
      });
      return { ok: true };
    },
  );
}
