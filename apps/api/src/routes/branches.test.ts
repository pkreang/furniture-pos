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
