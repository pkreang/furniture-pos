import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("GET /api/branches", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated request", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/branches" });
    await app.close();
    expect(res.statusCode).toBe(401);
  });

  it("rejects a user without branches.view", async () => {
    const userId = await createTestUser({ permissions: [] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/branches",
      cookies: await sessionCookie(userId),
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("returns all branches ordered by id for an authorised user", async () => {
    await prisma.branch.create({ data: { name: "สาขาสยาม", code: "BKK01" } });
    await prisma.branch.create({ data: { name: "คลังกลาง", code: "WH01", isWarehouse: true } });
    const userId = await createTestUser({ permissions: ["branches.view"] });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/branches",
      cookies: await sessionCookie(userId),
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].code).toBe("BKK01");
    expect(body[1].isWarehouse).toBe(true);
  });
});

describe("POST/PATCH /api/branches", () => {
  beforeEach(resetAuthTables);

  it("creates a branch with branches.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["branches.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/branches",
      cookies: await sessionCookie(adminId),
      payload: { name: "สาขาใหม่", code: "NEW01" },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().code).toBe("NEW01");
  });

  it("rejects creating a branch without branches.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["branches.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/branches",
      cookies: await sessionCookie(viewerId),
      payload: { name: "สาขาใหม่", code: "NEW01" },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("updates a branch with branches.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["branches.manage"] });
    const branch = await prisma.branch.create({ data: { name: "เดิม", code: "OLD01" } });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/branches/${branch.id}`,
      cookies: await sessionCookie(adminId),
      payload: { name: "ใหม่" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("ใหม่");
  });
});
