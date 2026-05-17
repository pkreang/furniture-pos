import type { AuthUser } from "../types/fastify.js";

/**
 * Returns a Prisma `where` fragment that restricts a query to the user's own
 * branch when their role is branch-scoped. For unscoped roles it returns `{}`.
 * The fragment must always be spread into queries server-side — never trust a
 * client-supplied branch id.
 */
export function branchFilter(user: AuthUser): { branchId?: number } {
  if (!user.isBranchScoped) return {};
  if (user.branchId == null) {
    throw new Error(`branch-scoped user ${user.id} has no branch assigned`);
  }
  return { branchId: user.branchId };
}
