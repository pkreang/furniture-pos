import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("roles routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists roles with their permission keys for a user with roles.view", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["roles.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/roles",
      cookies: await sessionCookie(adminId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const tester = res.json().find((r: { key: string }) => r.key === "tester");
    expect(tester.permissionKeys).toContain("roles.view");
  });

  it("lists the full permission catalog", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["roles.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/permissions",
      cookies: await sessionCookie(adminId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().some((p: { key: string }) => p.key === "roles.view")).toBe(true);
  });

  it("replaces a role's permissions with roles.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["roles.manage"] });
    await prisma.permission.createMany({
      data: [
        { key: "branches.view", description: "x" },
        { key: "branches.manage", description: "y" },
      ],
      skipDuplicates: true,
    });
    const target = await prisma.role.create({ data: { key: "editme", name: "Edit Me" } });
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/roles/${target.id}/permissions`,
      cookies: await sessionCookie(adminId),
      payload: { permissionKeys: ["branches.view", "branches.manage"] },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const after = await prisma.rolePermission.count({ where: { roleId: target.id } });
    expect(after).toBe(2);
  });

  it("rejects editing role permissions without roles.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["roles.view"] });
    const target = await prisma.role.create({ data: { key: "editme", name: "Edit Me" } });
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/roles/${target.id}/permissions`,
      cookies: await sessionCookie(viewerId),
      payload: { permissionKeys: [] },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });
});
