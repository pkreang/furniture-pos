import { describe, it, expect } from "vitest";
import { extractVat, calcPointsEarned } from "./money.js";

describe("extractVat", () => {
  it("splits a round VAT-inclusive amount", () => {
    expect(extractVat(107)).toEqual({ taxBase: 100, vatAmount: 7 });
    expect(extractVat(1070)).toEqual({ taxBase: 1000, vatAmount: 70 });
  });

  it("always re-sums to the gross input", () => {
    for (const gross of [1, 1000, 19900, 12345]) {
      const { taxBase, vatAmount } = extractVat(gross);
      expect(taxBase + vatAmount).toBe(gross);
    }
  });
});

describe("calcPointsEarned", () => {
  it("awards one point per 100 baht, floored", () => {
    expect(calcPointsEarned(250)).toBe(2);
    expect(calcPointsEarned(99)).toBe(0);
    expect(calcPointsEarned(100)).toBe(1);
  });
});
