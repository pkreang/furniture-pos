import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";
import { branchFilter } from "../auth/branch-scope.js";

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  name: true,
  roleId: true,
  branchId: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/users",
    { preHandler: [app.authenticate, app.requirePermission("users.view")] },
    async (request) => {
      return prisma.user.findMany({
        where: branchFilter(request.user!),
        select: PUBLIC_USER_SELECT,
        orderBy: { id: "asc" },
      });
    },
  );

  app.post(
    "/api/users",
    {
      preHandler: [app.authenticate, app.requirePermission("users.manage")],
      schema: {
        body: {
          type: "object",
          required: ["username", "name", "password", "roleId"],
          properties: {
            username: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 8 },
            roleId: { type: "integer" },
            branchId: { type: ["integer", "null"] },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        username: string;
        name: string;
        password: string;
        roleId: number;
        branchId?: number | null;
      };
      const user = await prisma.user.create({
        data: {
          username: body.username,
          name: body.name,
          passwordHash: await hashPassword(body.password),
          roleId: body.roleId,
          branchId: body.branchId ?? null,
          mustChangePassword: true,
        },
        select: PUBLIC_USER_SELECT,
      });
      return reply.code(201).send(user);
    },
  );

  app.patch(
    "/api/users/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("users.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            roleId: { type: "integer" },
            branchId: { type: ["integer", "null"] },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const id = Number((request.params as { id: string }).id);
      return prisma.user.update({
        where: { id },
        data: request.body as Record<string, unknown>,
        select: PUBLIC_USER_SELECT,
      });
    },
  );
}
