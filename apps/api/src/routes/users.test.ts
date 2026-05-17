import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("users routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists users for a user with users.view", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["users.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users",
      cookies: await sessionCookie(adminId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().some((u: { username: string }) => u.username === "admin")).toBe(true);
    expect(res.json()[0].passwordHash).toBeUndefined();
  });

  it("creates a user with users.manage and a hashed password", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["users.manage"] });
    const role = await prisma.role.findFirstOrThrow();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      cookies: await sessionCookie(adminId),
      payload: { username: "bob", name: "Bob", password: "bob-initial-pw", roleId: role.id },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    const bob = await prisma.user.findUniqueOrThrow({ where: { username: "bob" } });
    expect(bob.passwordHash).not.toBe("bob-initial-pw");
    expect(bob.mustChangePassword).toBe(true);
  });

  it("rejects creating a user without users.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["users.view"] });
    const role = await prisma.role.findFirstOrThrow();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      cookies: await sessionCookie(viewerId),
      payload: { username: "bob", name: "Bob", password: "bob-initial-pw", roleId: role.id },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("updates and deactivates a user with users.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["users.manage"] });
    const targetId = await createTestUser({ username: "target", roleKey: "other" });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/users/${targetId}`,
      cookies: await sessionCookie(adminId),
      payload: { name: "Renamed", isActive: false },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    expect(updated.name).toBe("Renamed");
    expect(updated.isActive).toBe(false);
  });
});
