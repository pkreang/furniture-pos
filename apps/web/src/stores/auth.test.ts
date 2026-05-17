import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "./auth";

function stubFetch(impl: (url: string, init?: RequestInit) => unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = impl(url, init);
      return { ok: true, json: async () => body };
    }),
  );
}

describe("auth store", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.restoreAllMocks());

  it("loads the current user and exposes permissions", async () => {
    stubFetch(() => ({
      id: 1,
      username: "alice",
      name: "Alice",
      roleKey: "admin",
      branchId: null,
      isBranchScoped: false,
      discountMaxPercent: null,
      permissions: ["users.view"],
      mustChangePassword: false,
    }));
    const store = useAuthStore();
    await store.loadMe();

    expect(store.user?.username).toBe("alice");
    expect(store.hasPermission("users.view")).toBe(true);
    expect(store.hasPermission("users.manage")).toBe(false);
  });

  it("clears the user on logout", async () => {
    stubFetch(() => ({ ok: true }));
    const store = useAuthStore();
    store.user = {
      id: 1, username: "a", name: "A", roleKey: "admin", branchId: null,
      isBranchScoped: false, discountMaxPercent: null, permissions: [], mustChangePassword: false,
    };
    await store.logout();
    expect(store.user).toBeNull();
  });
});
