import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("delivery config routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates and lists a delivery zone with delivery.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["delivery.manage", "delivery.view"] });
    const app = buildApp();
    const cookies = await sessionCookie(adminId);

    const created = await app.inject({
      method: "POST",
      url: "/api/delivery/zones",
      cookies,
      payload: { name: "ในเมือง", fee: 200 },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().fee).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/delivery/zones", cookies });
    await app.close();
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
  });

  it("rejects creating a zone without delivery.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["delivery.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/delivery/zones",
      cookies: await sessionCookie(viewerId),
      payload: { name: "x", fee: 0 },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("creates a channel, a team, and a driver", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["delivery.manage", "delivery.view"] });
    const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
    const app = buildApp();
    const cookies = await sessionCookie(adminId);

    const channel = await app.inject({
      method: "POST",
      url: "/api/delivery/channels",
      cookies,
      payload: { name: "ทีมบริษัท", type: "IN_HOUSE" },
    });
    expect(channel.statusCode).toBe(201);

    const team = await app.inject({
      method: "POST",
      url: "/api/delivery/teams",
      cookies,
      payload: { name: "ทีม A", branchId: branch.id },
    });
    expect(team.statusCode).toBe(201);

    const driver = await app.inject({
      method: "POST",
      url: "/api/delivery/drivers",
      cookies,
      payload: { name: "สมชาย", teamId: team.json().id },
    });
    await app.close();
    expect(driver.statusCode).toBe(201);
    expect(driver.json().isActive).toBe(true);
  });

  it("deactivates a driver via PATCH", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["delivery.manage"] });
    const branch = await prisma.branch.create({ data: { name: "สาขา", code: "SH" } });
    const team = await prisma.deliveryTeam.create({ data: { name: "ทีม", branchId: branch.id } });
    const driver = await prisma.driver.create({ data: { name: "คนขับ", teamId: team.id } });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/delivery/drivers/${driver.id}`,
      cookies: await sessionCookie(adminId),
      payload: { isActive: false },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().isActive).toBe(false);
  });

  it("updates a zone fee via PATCH", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["delivery.manage"] });
    const zone = await prisma.deliveryZone.create({ data: { name: "โซน", fee: 100 } });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/delivery/zones/${zone.id}`,
      cookies: await sessionCookie(adminId),
      payload: { fee: 350 },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().fee).toBe(350);
  });
});
