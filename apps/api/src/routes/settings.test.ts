import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("settings routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("updates an allowlisted setting with settings.manage", async () => {
    await prisma.appSetting.create({ data: { key: "company.name", value: "เดิม" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["settings.manage"] });
    const app = buildApp();
    const cookies = await sessionCookie(adminId);

    const res = await app.inject({
      method: "PUT",
      url: "/api/settings",
      cookies,
      payload: { "company.name": "ชื่อใหม่" },
    });
    expect(res.statusCode).toBe(200);

    const get = await app.inject({ method: "GET", url: "/api/settings", cookies });
    await app.close();
    expect(get.json()["company.name"]).toBe("ชื่อใหม่");
  });

  it("rejects an unknown settings key", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["settings.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/settings",
      cookies: await sessionCookie(adminId),
      payload: { "evil.key": "x" },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("UNKNOWN_KEY");
  });

  it("rejects updating settings without settings.manage", async () => {
    const userId = await createTestUser({ username: "nobody", permissions: [] });
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/settings",
      cookies: await sessionCookie(userId),
      payload: { "company.name": "x" },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });
});
