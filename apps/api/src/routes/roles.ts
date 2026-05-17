import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function roleRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/roles",
    { preHandler: [app.authenticate, app.requirePermission("roles.view")] },
    async () => {
      const roles = await prisma.role.findMany({
        include: { permissions: { include: { permission: true } } },
        orderBy: { id: "asc" },
      });
      return roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        isBranchScoped: r.isBranchScoped,
        discountMaxPercent: r.discountMaxPercent,
        permissionKeys: r.permissions.map((rp) => rp.permission.key),
      }));
    },
  );

  app.get(
    "/api/permissions",
    { preHandler: [app.authenticate, app.requirePermission("roles.view")] },
    async () => {
      return prisma.permission.findMany({ orderBy: { key: "asc" } });
    },
  );

  app.put(
    "/api/roles/:id/permissions",
    {
      preHandler: [app.authenticate, app.requirePermission("roles.manage")],
      schema: {
        body: {
          type: "object",
          required: ["permissionKeys"],
          properties: {
            permissionKeys: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      const roleId = Number((request.params as { id: string }).id);
      const { permissionKeys } = request.body as { permissionKeys: string[] };
      const perms = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
      if (perms.length !== permissionKeys.length) {
        return reply.code(400).send({ code: "UNKNOWN_PERMISSION", message: "พบสิทธิ์ที่ไม่รู้จัก" });
      }
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId } }),
        prisma.rolePermission.createMany({
          data: perms.map((p) => ({ roleId, permissionId: p.id })),
        }),
      ]);
      return { ok: true };
    },
  );
}
