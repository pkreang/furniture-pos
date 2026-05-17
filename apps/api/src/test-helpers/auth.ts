import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";
import { createSession } from "../auth/session.js";

interface TestUserOpts {
  username?: string;
  roleKey?: string;
  permissions?: string[];
  isBranchScoped?: boolean;
  branchId?: number | null;
  mustChangePassword?: boolean;
}

/** Creates a role (with the given permissions) and a user, returning the user id. */
export async function createTestUser(opts: TestUserOpts = {}): Promise<number> {
  const roleKey = opts.roleKey ?? "tester";
  const role = await prisma.role.create({
    data: { key: roleKey, name: roleKey, isBranchScoped: opts.isBranchScoped ?? false },
  });
  for (const key of opts.permissions ?? []) {
    const perm = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  const user = await prisma.user.create({
    data: {
      username: opts.username ?? "tester",
      passwordHash: await hashPassword("pw"),
      name: opts.username ?? "tester",
      roleId: role.id,
      branchId: opts.branchId ?? null,
      mustChangePassword: opts.mustChangePassword ?? false,
    },
  });
  return user.id;
}

/** Creates a session for a user id and returns the cookie map for `app.inject`. */
export async function sessionCookie(userId: number): Promise<{ fh_session: string }> {
  return { fh_session: await createSession(userId) };
}

/** Deletes all auth, catalog, stock, and branch rows. Call in `beforeEach`. */
export async function resetAuthTables(): Promise<void> {
  // Catalog + stock + customers first — they reference users, branches, and each other.
  await prisma.stockMovement.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.sofaColor.deleteMany();
  await prisma.sofaMaterial.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.pointTransaction.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.branch.deleteMany();
}
