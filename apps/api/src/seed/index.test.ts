import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { runSeed } from "./index.js";
import { PERMISSIONS, ROLES } from "./catalog.js";

describe("runSeed", () => {
  beforeEach(async () => {
    process.env.SEED_ADMIN_USERNAME = "admin";
    process.env.SEED_ADMIN_PASSWORD = "seed-test-pw";
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates every permission and role with its permission set", async () => {
    await runSeed(prisma);

    expect(await prisma.permission.count()).toBe(PERMISSIONS.length);
    expect(await prisma.role.count()).toBe(ROLES.length);

    const owner = await prisma.role.findUniqueOrThrow({
      where: { key: "owner" },
      include: { permissions: true },
    });
    expect(owner.permissions).toHaveLength(PERMISSIONS.length);

    const cashier = await prisma.role.findUniqueOrThrow({
      where: { key: "cashier" },
      include: { permissions: true },
    });
    expect(cashier.isBranchScoped).toBe(true);
    expect(cashier.permissions).toHaveLength(1);
  });

  it("creates an admin user that must change password, and is idempotent", async () => {
    await runSeed(prisma);
    await runSeed(prisma); // second run must not duplicate or throw

    const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
    expect(admin.mustChangePassword).toBe(true);
    expect(admin.passwordHash).not.toBe("seed-test-pw");
    expect(await prisma.user.count()).toBe(1);
  });
});
