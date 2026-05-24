import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./password.js";

/**
 * On API boot, applies the `RESET_USER_*` env vars set by the host operator.
 * Both reset and bootstrap-create use the same mechanism so the operator can
 * unblock a forgotten password OR provision a missing account (e.g. the first
 * owner login after deploy) without redeploying, and remove the env vars after
 * first login.
 *
 *   RESET_USER_USERNAME  (required)  the username to act on
 *   RESET_USER_PASSWORD  (required)  the new password (forced change on first login)
 *   RESET_USER_ROLE      (optional)  role key — required to create a missing user;
 *                                    ignored (with a warning) for an existing user
 *   RESET_USER_NAME      (optional)  display name when creating; defaults to username
 *   RESET_USER_BRANCH    (optional)  branch code — required when the role is
 *                                    branch-scoped; warned-and-ignored otherwise
 *
 * If `RESET_USER_USERNAME` or `RESET_USER_PASSWORD` is unset, this is a no-op.
 * Misconfiguration (unknown role, branch-scoped role without a valid branch)
 * throws so the API fails to boot loudly — the operator fixes the env var and
 * restarts.
 */
export async function runBootstrapResets(prisma: PrismaClient): Promise<void> {
  const username = process.env.RESET_USER_USERNAME;
  const password = process.env.RESET_USER_PASSWORD;
  if (!username || !password) return;

  const roleKey = process.env.RESET_USER_ROLE;
  const branchCode = process.env.RESET_USER_BRANCH;
  const displayName = process.env.RESET_USER_NAME;

  const user = await prisma.user.findUnique({ where: { username } });

  if (user) {
    if (roleKey) {
      console.warn(
        `[bootstrap] RESET_USER_ROLE="${roleKey}" ignored — user "${username}" already exists; role unchanged`,
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
    });
    console.log(
      `[bootstrap] reset password for user "${username}" — REMOVE RESET_USER_* env vars after first login`,
    );
    return;
  }

  if (!roleKey) {
    console.warn(
      `[bootstrap] RESET_USER_USERNAME="${username}" set but no such user exists — skipping (set RESET_USER_ROLE to create)`,
    );
    return;
  }

  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) {
    const valid = (await prisma.role.findMany({ select: { key: true }, orderBy: { key: "asc" } }))
      .map((r) => r.key)
      .join(", ");
    throw new Error(
      `[bootstrap] RESET_USER_ROLE="${roleKey}" is not a known role. Valid keys: ${valid}`,
    );
  }

  let branchId: number | null = null;
  if (role.isBranchScoped) {
    if (!branchCode) {
      throw new Error(
        `[bootstrap] role "${roleKey}" is branch-scoped — set RESET_USER_BRANCH to a branch code`,
      );
    }
    const branch = await prisma.branch.findUnique({ where: { code: branchCode } });
    if (!branch) {
      const valid = (await prisma.branch.findMany({ select: { code: true }, orderBy: { code: "asc" } }))
        .map((b) => b.code)
        .join(", ");
      throw new Error(
        `[bootstrap] RESET_USER_BRANCH="${branchCode}" is not a known branch. Valid codes: ${valid}`,
      );
    }
    branchId = branch.id;
  } else if (branchCode) {
    console.warn(
      `[bootstrap] RESET_USER_BRANCH="${branchCode}" ignored — role "${roleKey}" is not branch-scoped`,
    );
  }

  await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      name: displayName ?? username,
      roleId: role.id,
      branchId,
      mustChangePassword: true,
    },
  });
  console.log(
    `[bootstrap] created user "${username}" with role "${roleKey}" — REMOVE RESET_USER_* env vars after first login`,
  );
}
