import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";

describe("GET /api/branches", () => {
  beforeEach(async () => {
    await prisma.branch.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns all branches ordered by id", async () => {
    await prisma.branch.create({ data: { name: "สาขาสยาม", code: "BKK01" } });
    await prisma.branch.create({ data: { name: "คลังกลาง", code: "WH01", isWarehouse: true } });

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/branches" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].code).toBe("BKK01");
    expect(body[1].isWarehouse).toBe(true);
  });
});
