import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { prisma } from "../prisma.js";
import { resetAuthTables } from "../test-helpers/auth.js";
import { hashPassword, verifyPassword } from "./password.js";
import { runBootstrapResets } from "./bootstrap-reset.js";

const RESET_ENV_KEYS = [
  "RESET_USER_USERNAME",
  "RESET_USER_PASSWORD",
  "RESET_USER_ROLE",
  "RESET_USER_NAME",
  "RESET_USER_BRANCH",
] as const;

function clearResetEnv(): void {
  for (const key of RESET_ENV_KEYS) {
    delete process.env[key];
  }
}

async function seedRoles(): Promise<void> {
  await prisma.role.create({ data: { key: "owner", name: "Owner", isBranchScoped: false } });
  await prisma.role.create({ data: { key: "manager", name: "Manager", isBranchScoped: true } });
}

async function seedAdminUser(): Promise<{ id: number; roleId: number; originalHash: string }> {
  const adminRole = await prisma.role.create({
    data: { key: "admin", name: "Admin", isBranchScoped: false },
  });
  const originalHash = await hashPassword("original-pw");
  const user = await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: originalHash,
      name: "Admin",
      roleId: adminRole.id,
      mustChangePassword: false,
    },
  });
  return { id: user.id, roleId: adminRole.id, originalHash };
}

describe("runBootstrapResets", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    clearResetEnv();
    await resetAuthTables();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    clearResetEnv();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is a no-op when no env vars are set", async () => {
    await seedRoles();
    await runBootstrapResets(prisma);
    expect(await prisma.user.count()).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("is a no-op when password is missing", async () => {
    await seedRoles();
    process.env.RESET_USER_USERNAME = "owner";
    await runBootstrapResets(prisma);
    expect(await prisma.user.count()).toBe(0);
  });

  it("resets an existing user's password and forces a change on first login", async () => {
    const { id, originalHash } = await seedAdminUser();
    process.env.RESET_USER_USERNAME = "admin";
    process.env.RESET_USER_PASSWORD = "rotated-pw";

    await runBootstrapResets(prisma);

    const after = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(after.passwordHash).not.toBe(originalHash);
    expect(await verifyPassword(after.passwordHash, "rotated-pw")).toBe(true);
    expect(after.mustChangePassword).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('reset password for user "admin"'));
  });

  it("ignores RESET_USER_ROLE for an existing user and warns", async () => {
    const { id, roleId: originalRoleId } = await seedAdminUser();
    await prisma.role.create({ data: { key: "owner", name: "Owner", isBranchScoped: false } });
    process.env.RESET_USER_USERNAME = "admin";
    process.env.RESET_USER_PASSWORD = "rotated-pw";
    process.env.RESET_USER_ROLE = "owner";

    await runBootstrapResets(prisma);

    const after = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(after.roleId).toBe(originalRoleId);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ignored"));
  });

  it("warns and skips when the user does not exist and no role is given (legacy behavior)", async () => {
    await seedRoles();
    process.env.RESET_USER_USERNAME = "owner";
    process.env.RESET_USER_PASSWORD = "irrelevant-pw";

    await runBootstrapResets(prisma);

    expect(await prisma.user.count()).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no such user exists"));
  });

  it("creates a missing non-branch-scoped user when RESET_USER_ROLE is set", async () => {
    await seedRoles();
    process.env.RESET_USER_USERNAME = "owner";
    process.env.RESET_USER_PASSWORD = "bootstrap-pw";
    process.env.RESET_USER_ROLE = "owner";

    await runBootstrapResets(prisma);

    const created = await prisma.user.findUniqueOrThrow({
      where: { username: "owner" },
      include: { role: true },
    });
    expect(created.role.key).toBe("owner");
    expect(created.branchId).toBeNull();
    expect(created.mustChangePassword).toBe(true);
    expect(created.name).toBe("owner");
    expect(await verifyPassword(created.passwordHash, "bootstrap-pw")).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('created user "owner"'));
  });

  it("uses RESET_USER_NAME as the display name when set", async () => {
    await seedRoles();
    process.env.RESET_USER_USERNAME = "owner";
    process.env.RESET_USER_PASSWORD = "bootstrap-pw";
    process.env.RESET_USER_ROLE = "owner";
    process.env.RESET_USER_NAME = "เจ้าของร้าน";

    await runBootstrapResets(prisma);

    const created = await prisma.user.findUniqueOrThrow({ where: { username: "owner" } });
    expect(created.name).toBe("เจ้าของร้าน");
  });

  it("creates a branch-scoped user when RESET_USER_BRANCH resolves to a branch", async () => {
    await seedRoles();
    const branch = await prisma.branch.create({
      data: { name: "Siam", code: "siam", isWarehouse: false },
    });
    process.env.RESET_USER_USERNAME = "siam_mgr";
    process.env.RESET_USER_PASSWORD = "bootstrap-pw";
    process.env.RESET_USER_ROLE = "manager";
    process.env.RESET_USER_BRANCH = "siam";

    await runBootstrapResets(prisma);

    const created = await prisma.user.findUniqueOrThrow({ where: { username: "siam_mgr" } });
    expect(created.branchId).toBe(branch.id);
  });

  it("throws when the role is branch-scoped but RESET_USER_BRANCH is missing", async () => {
    await seedRoles();
    process.env.RESET_USER_USERNAME = "siam_mgr";
    process.env.RESET_USER_PASSWORD = "bootstrap-pw";
    process.env.RESET_USER_ROLE = "manager";

    await expect(runBootstrapResets(prisma)).rejects.toThrow(/branch-scoped/);
    expect(await prisma.user.count()).toBe(0);
  });

  it("throws when RESET_USER_BRANCH is an unknown branch code", async () => {
    await seedRoles();
    await prisma.branch.create({ data: { name: "Siam", code: "siam", isWarehouse: false } });
    process.env.RESET_USER_USERNAME = "ghost_mgr";
    process.env.RESET_USER_PASSWORD = "bootstrap-pw";
    process.env.RESET_USER_ROLE = "manager";
    process.env.RESET_USER_BRANCH = "nowhere";

    await expect(runBootstrapResets(prisma)).rejects.toThrow(/not a known branch/);
    expect(await prisma.user.count()).toBe(0);
  });

  it("warns and ignores RESET_USER_BRANCH for a non-branch-scoped role", async () => {
    await seedRoles();
    await prisma.branch.create({ data: { name: "Siam", code: "siam", isWarehouse: false } });
    process.env.RESET_USER_USERNAME = "owner";
    process.env.RESET_USER_PASSWORD = "bootstrap-pw";
    process.env.RESET_USER_ROLE = "owner";
    process.env.RESET_USER_BRANCH = "siam";

    await runBootstrapResets(prisma);

    const created = await prisma.user.findUniqueOrThrow({ where: { username: "owner" } });
    expect(created.branchId).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not branch-scoped"));
  });

  it("throws with a helpful message when RESET_USER_ROLE is unknown", async () => {
    await seedRoles();
    process.env.RESET_USER_USERNAME = "owner";
    process.env.RESET_USER_PASSWORD = "bootstrap-pw";
    process.env.RESET_USER_ROLE = "bogus";

    await expect(runBootstrapResets(prisma)).rejects.toThrow(/not a known role/);
    expect(await prisma.user.count()).toBe(0);
  });
});
