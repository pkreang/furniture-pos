import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("audit log", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("records a row for a successful mutation but not for a GET", async () => {
    const adminId = await createTestUser({
      username: "admin",
      permissions: ["catalog.manage", "catalog.view", "audit.view"],
    });
    const app = buildApp();
    const cookies = await sessionCookie(adminId);

    await app.inject({
      method: "POST",
      url: "/api/categories",
      cookies,
      payload: { name: "หมวดทดสอบ" },
    });
    await app.inject({ method: "GET", url: "/api/categories", cookies });
    await app.close();

    const rows = await prisma.auditLog.findMany();
    const posts = rows.filter((r) => r.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe("/api/categories");
    expect(posts[0].userId).toBe(adminId);
    expect(posts[0].statusCode).toBeLessThan(400);
    expect(rows.some((r) => r.method === "GET")).toBe(false);
  });

  it("lists the audit log for a user with audit.view", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["audit.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/audit-log",
      cookies: await sessionCookie(adminId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("rejects the audit log without audit.view", async () => {
    const userId = await createTestUser({ username: "nobody", permissions: [] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/audit-log",
      cookies: await sessionCookie(userId),
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });
});
