import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("categories routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists categories for a user with catalog.view", async () => {
    await prisma.category.create({ data: { name: "โซฟา" } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["catalog.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/categories",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].name).toBe("โซฟา");
  });

  it("rejects listing without catalog.view", async () => {
    const nobodyId = await createTestUser({ username: "nobody", permissions: [] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/categories",
      cookies: await sessionCookie(nobodyId),
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("creates a category with catalog.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/categories",
      cookies: await sessionCookie(adminId),
      payload: { name: "เตียง" },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe("เตียง");
  });

  it("rejects creating a category without catalog.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["catalog.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/categories",
      cookies: await sessionCookie(viewerId),
      payload: { name: "เตียง" },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("rejects a duplicate category name with 409", async () => {
    await prisma.category.create({ data: { name: "โต๊ะ" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/categories",
      cookies: await sessionCookie(adminId),
      payload: { name: "โต๊ะ" },
    });
    await app.close();
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("DUPLICATE");
  });

  it("updates a category with catalog.manage", async () => {
    const category = await prisma.category.create({ data: { name: "เก่า" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/categories/${category.id}`,
      cookies: await sessionCookie(adminId),
      payload: { name: "ใหม่" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("ใหม่");
  });
});
