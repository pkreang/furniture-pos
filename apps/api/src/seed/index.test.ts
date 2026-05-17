import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables } from "../test-helpers/auth.js";
import { runSeed } from "./index.js";
import { PERMISSIONS, ROLES, SOFA_MATERIALS, APP_SETTINGS } from "./catalog.js";

describe("runSeed", () => {
  beforeEach(async () => {
    process.env.SEED_ADMIN_USERNAME = "admin";
    process.env.SEED_ADMIN_PASSWORD = "seed-test-pw";
    await resetAuthTables();
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
    expect(cashier.permissions).toHaveLength(11);
  });

  it("seeds the company app settings idempotently", async () => {
    await runSeed(prisma);
    await runSeed(prisma);

    expect(await prisma.appSetting.count()).toBe(Object.keys(APP_SETTINGS).length);
    const name = await prisma.appSetting.findUniqueOrThrow({ where: { key: "company.name" } });
    expect(name.value).toBe(APP_SETTINGS["company.name"]);
  });

  it("creates sofa materials with colors, idempotently", async () => {
    await runSeed(prisma);
    await runSeed(prisma); // second run must not duplicate colors

    expect(await prisma.sofaMaterial.count()).toBe(SOFA_MATERIALS.length);

    const luxury = await prisma.sofaMaterial.findUniqueOrThrow({
      where: { key: "luxury" },
      include: { colors: true },
    });
    expect(luxury.priceMultiplierPct).toBe(210);
    expect(luxury.colors).toHaveLength(3);
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
