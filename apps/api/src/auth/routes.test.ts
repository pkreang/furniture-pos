import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { hashPassword } from "./password.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

async function makeUser(opts: { password: string; isActive?: boolean }): Promise<void> {
  const role = await prisma.role.create({ data: { key: "admin", name: "Admin" } });
  await prisma.user.create({
    data: {
      username: "alice",
      passwordHash: await hashPassword(opts.password),
      name: "Alice",
      roleId: role.id,
      isActive: opts.isActive ?? true,
      mustChangePassword: false,
    },
  });
}

describe("auth routes", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects login with wrong credentials", async () => {
    await makeUser({ password: "correct-pw" });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "wrong-pw" },
    });
    await app.close();
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in, sets a session cookie, and resolves /api/auth/me", async () => {
    await makeUser({ password: "correct-pw" });
    const app = buildApp();

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "correct-pw" },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.cookies.find((c) => c.name === "fh_session");
    expect(cookie?.httpOnly).toBe(true);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { fh_session: cookie!.value },
    });
    await app.close();
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe("alice");
  });

  it("rejects /api/auth/me without a session cookie", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    await app.close();
    expect(res.statusCode).toBe(401);
  });

  it("logout revokes the session", async () => {
    await makeUser({ password: "correct-pw" });
    const app = buildApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "correct-pw" },
    });
    const token = login.cookies.find((c) => c.name === "fh_session")!.value;

    await app.inject({ method: "POST", url: "/api/auth/logout", cookies: { fh_session: token } });
    const me = await app.inject({ method: "GET", url: "/api/auth/me", cookies: { fh_session: token } });
    await app.close();
    expect(me.statusCode).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  beforeEach(resetAuthTables);

  it("blocks protected routes until the password is changed", async () => {
    const userId = await createTestUser({ permissions: ["branches.view"], mustChangePassword: true });
    const app = buildApp();
    const cookies = await sessionCookie(userId);

    const before = await app.inject({ method: "GET", url: "/api/branches", cookies });
    expect(before.statusCode).toBe(403);
    expect(before.json().code).toBe("MUST_CHANGE_PASSWORD");

    const change = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies,
      payload: { currentPassword: "pw", newPassword: "brand-new-pw" },
    });
    expect(change.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/api/branches", cookies });
    await app.close();
    expect(after.statusCode).toBe(200);
  });

  it("rejects a wrong current password", async () => {
    const userId = await createTestUser({ mustChangePassword: true });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: await sessionCookie(userId),
      payload: { currentPassword: "not-pw", newPassword: "brand-new-pw" },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
  });
});
