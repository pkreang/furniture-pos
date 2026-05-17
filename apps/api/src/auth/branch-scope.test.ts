import { describe, it, expect } from "vitest";
import { branchFilter } from "./branch-scope.js";
import type { AuthUser } from "../types/fastify.js";

function user(partial: Partial<AuthUser>): AuthUser {
  return {
    id: 1,
    username: "u",
    name: "U",
    roleKey: "r",
    branchId: null,
    isBranchScoped: false,
    discountMaxPercent: null,
    permissions: [],
    mustChangePassword: false,
    ...partial,
  };
}

describe("branchFilter", () => {
  it("returns an empty filter for a non-branch-scoped user", () => {
    expect(branchFilter(user({ isBranchScoped: false }))).toEqual({});
  });

  it("forces the user's own branchId for a branch-scoped user", () => {
    expect(branchFilter(user({ isBranchScoped: true, branchId: 4 }))).toEqual({ branchId: 4 });
  });

  it("throws if a branch-scoped user has no branch assigned", () => {
    expect(() => branchFilter(user({ isBranchScoped: true, branchId: null }))).toThrow();
  });
});
