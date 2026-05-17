import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { findSessionUser } from "./session.js";
import type { AuthUser } from "../types/fastify.js";

export const SESSION_COOKIE = "fh_session";

async function authPlugin(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.decorateRequest("user", undefined);
  app.decorateRequest("sessionToken", undefined);

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const token = request.cookies[SESSION_COOKIE];
      const sessionUser = token ? await findSessionUser(token) : null;
      if (!token || !sessionUser || !sessionUser.isActive) {
        await reply.code(401).send({ code: "UNAUTHENTICATED", message: "ต้องเข้าสู่ระบบ" });
        return;
      }
      const user: AuthUser = {
        id: sessionUser.id,
        username: sessionUser.username,
        name: sessionUser.name,
        roleKey: sessionUser.role.key,
        branchId: sessionUser.branchId,
        isBranchScoped: sessionUser.role.isBranchScoped,
        discountMaxPercent: sessionUser.role.discountMaxPercent,
        permissions: sessionUser.role.permissions.map((rp) => rp.permission.key),
        mustChangePassword: sessionUser.mustChangePassword,
      };
      request.user = user;
      request.sessionToken = token;
    },
  );

  app.decorate("requirePermission", (key: string) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const user = request.user;
      if (!user) {
        await reply.code(401).send({ code: "UNAUTHENTICATED", message: "ต้องเข้าสู่ระบบ" });
        return;
      }
      if (user.mustChangePassword) {
        await reply
          .code(403)
          .send({ code: "MUST_CHANGE_PASSWORD", message: "ต้องเปลี่ยนรหัสผ่านก่อน" });
        return;
      }
      if (!user.permissions.includes(key)) {
        await reply.code(403).send({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์เข้าถึง" });
        return;
      }
    };
  });
}

export default fp(authPlugin);
