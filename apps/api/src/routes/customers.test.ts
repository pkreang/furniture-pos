import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("customers routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists customers with a computed tier for a user with customers.view", async () => {
    await prisma.customer.create({ data: { name: "สมชาย", phone: "0810000001" } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["customers.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/customers",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].tier.key).toBe("bronze");
  });

  it("filters customers by name or phone with ?q=", async () => {
    await prisma.customer.create({ data: { name: "สมชาย ใจดี", phone: "0810000001" } });
    await prisma.customer.create({ data: { name: "สมหญิง", phone: "0899999999" } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["customers.view"] });
    const app = buildApp();

    const byName = await app.inject({
      method: "GET",
      url: "/api/customers?q=ใจดี",
      cookies: await sessionCookie(viewerId),
    });
    expect(byName.json()).toHaveLength(1);

    const byPhone = await app.inject({
      method: "GET",
      url: "/api/customers?q=0899",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(byPhone.json()).toHaveLength(1);
    expect(byPhone.json()[0].name).toBe("สมหญิง");
  });

  it("creates a customer with customers.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["customers.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/customers",
      cookies: await sessionCookie(adminId),
      payload: { name: "ลูกค้าใหม่", phone: "0812223333", email: "a@b.com" },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().phone).toBe("0812223333");
    expect(res.json().pointsBalance).toBe(0);
  });

  it("rejects creating a customer without customers.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["customers.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/customers",
      cookies: await sessionCookie(viewerId),
      payload: { name: "x", phone: "0800000000" },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("rejects a duplicate phone with 409", async () => {
    await prisma.customer.create({ data: { name: "เดิม", phone: "0810000009" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["customers.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/customers",
      cookies: await sessionCookie(adminId),
      payload: { name: "ใหม่", phone: "0810000009" },
    });
    await app.close();
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("DUPLICATE");
  });

  it("updates a customer's tax fields with customers.manage", async () => {
    const customer = await prisma.customer.create({ data: { name: "บริษัท", phone: "0820000000" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["customers.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/customers/${customer.id}`,
      cookies: await sessionCookie(adminId),
      payload: { taxId: "0105500000001", taxName: "บริษัท จำกัด", taxAddress: "กรุงเทพฯ" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().taxId).toBe("0105500000001");
  });

  it("returns customer detail with tier and point history", async () => {
    const customer = await prisma.customer.create({ data: { name: "รายละเอียด", phone: "0830000000" } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["customers.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/customers/${customer.id}`,
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().tier.key).toBe("bronze");
    expect(Array.isArray(res.json().pointTransactions)).toBe(true);
  });

  it("adjusts a customer's points with customers.manage", async () => {
    const customer = await prisma.customer.create({ data: { name: "แต้ม", phone: "0840000000" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["customers.view", "customers.manage"] });
    const app = buildApp();
    const cookies = await sessionCookie(adminId);

    const adjust = await app.inject({
      method: "POST",
      url: `/api/customers/${customer.id}/points`,
      cookies,
      payload: { delta: 150, note: "โปรโมชัน" },
    });
    expect(adjust.statusCode).toBe(200);
    expect(adjust.json().pointsBalance).toBe(150);

    const detail = await app.inject({
      method: "GET",
      url: `/api/customers/${customer.id}`,
      cookies,
    });
    await app.close();
    expect(detail.json().pointTransactions).toHaveLength(1);
  });

  it("rejects a point adjustment that overdraws the balance", async () => {
    const customer = await prisma.customer.create({ data: { name: "ติดลบ", phone: "0850000000" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["customers.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/customers/${customer.id}/points`,
      cookies: await sessionCookie(adminId),
      payload: { delta: -10 },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INSUFFICIENT_POINTS");
  });

  it("rejects point adjustment without customers.manage", async () => {
    const customer = await prisma.customer.create({ data: { name: "ห้าม", phone: "0860000000" } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["customers.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/customers/${customer.id}/points`,
      cookies: await sessionCookie(viewerId),
      payload: { delta: 10 },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });
});
