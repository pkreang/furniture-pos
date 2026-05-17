import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useBranchStore } from "./branch";

describe("branch store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads branches from the API into state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, name: "สาขาสยาม", code: "BKK01", isWarehouse: false },
        ],
      }),
    );

    const store = useBranchStore();
    await store.load();

    expect(store.branches).toHaveLength(1);
    expect(store.branches[0].code).toBe("BKK01");
  });
});
