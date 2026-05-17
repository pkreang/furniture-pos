import { describe, it, expect } from "vitest";
import { getTier } from "./tiers.js";

describe("getTier", () => {
  it("returns bronze for zero spend", () => {
    expect(getTier(0).key).toBe("bronze");
  });

  it("stays on the lower tier just below a threshold", () => {
    expect(getTier(29999).key).toBe("bronze");
    expect(getTier(99999).key).toBe("silver");
  });

  it("promotes exactly at a threshold", () => {
    expect(getTier(30000).key).toBe("silver");
    expect(getTier(100000).key).toBe("gold");
    expect(getTier(300000).key).toBe("platinum");
  });

  it("returns platinum for a very large spend", () => {
    expect(getTier(5_000_000).key).toBe("platinum");
  });
});
