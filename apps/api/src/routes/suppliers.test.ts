import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("suppliers routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists active suppliers for a user with suppliers.view", async () => {
    await prisma.supplier.create({ data: { name: "ผู้จำหน่าย A", phone: "021110000" } });
    await prisma.supplier.create({ data: { name: "ผู้จำหน่าย B", phone: "021110001", isActive: false } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["suppliers.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/suppliers",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("ผู้จำหน่าย A");
  });

  it("filters suppliers by name or phone with ?q=", async () => {
    await prisma.supplier.create({ data: { name: "Acme Wood", phone: "021110000" } });
    await prisma.supplier.create({ data: { name: "Beta Cloth", phone: "029990000" } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["suppliers.view"] });
    const app = buildApp();

    const byName = await app.inject({
      method: "GET",
      url: "/api/suppliers?q=Acme",
      cookies: await sessionCookie(viewerId),
    });
    expect(byName.json()).toHaveLength(1);

    const byPhone = await app.inject({
      method: "GET",
      url: "/api/suppliers?q=029",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(byPhone.json()).toHaveLength(1);
    expect(byPhone.json()[0].name).toBe("Beta Cloth");
  });

  it("returns inactive suppliers when ?active=false", async () => {
    await prisma.supplier.create({ data: { name: "Inactive Co", isActive: false } });
    const viewerId = await createTestUser({ username: "viewer", permissions: ["suppliers.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/suppliers?active=false",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].isActive).toBe(false);
  });

  it("creates a supplier with suppliers.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["suppliers.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/suppliers",
      cookies: await sessionCookie(adminId),
      payload: {
        name: "ผู้จำหน่ายใหม่",
        contactName: "คุณสมชาย",
        phone: "021234567",
        email: "supplier@example.com",
        taxId: "0105500000001",
      },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe("ผู้จำหน่ายใหม่");
    expect(res.json().contactName).toBe("คุณสมชาย");
    expect(res.json().isActive).toBe(true);
  });

  it("rejects creating a supplier without suppliers.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["suppliers.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/suppliers",
      cookies: await sessionCookie(viewerId),
      payload: { name: "x" },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for a missing supplier", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["suppliers.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/suppliers/99999",
      cookies: await sessionCookie(viewerId),
    });
    await app.close();
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  it("updates a supplier with suppliers.manage", async () => {
    const supplier = await prisma.supplier.create({ data: { name: "เดิม" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["suppliers.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/suppliers/${supplier.id}`,
      cookies: await sessionCookie(adminId),
      payload: { contactName: "คุณใหม่", notes: "ติดต่อตอนเช้า" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().contactName).toBe("คุณใหม่");
    expect(res.json().notes).toBe("ติดต่อตอนเช้า");
  });

  it("soft-deletes a supplier by setting isActive=false", async () => {
    const supplier = await prisma.supplier.create({ data: { name: "เลิกใช้" } });
    const adminId = await createTestUser({ username: "admin", permissions: ["suppliers.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/suppliers/${supplier.id}`,
      cookies: await sessionCookie(adminId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    const after = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    expect(after?.isActive).toBe(false);
  });
});
