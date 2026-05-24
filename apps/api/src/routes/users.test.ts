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

  it("admin resets another user's password and forces them to change it", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["users.manage"] });
    const targetId = await createTestUser({ username: "forgetful", roleKey: "other" });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/users/${targetId}/reset-password`,
      cookies: await sessionCookie(adminId),
      payload: { newPassword: "fresh-pw-2026" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(after.passwordHash).not.toBe("fresh-pw-2026");
    expect(after.mustChangePassword).toBe(true);
  });

  it("rejects password reset without users.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["users.view"] });
    const targetId = await createTestUser({ username: "target", roleKey: "other" });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/users/${targetId}/reset-password`,
      cookies: await sessionCookie(viewerId),
      payload: { newPassword: "should-not-apply" },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when resetting a non-existent user", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["users.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/999999/reset-password",
      cookies: await sessionCookie(adminId),
      payload: { newPassword: "no-user-here" },
    });
    await app.close();
    expect(res.statusCode).toBe(404);
  });
});
