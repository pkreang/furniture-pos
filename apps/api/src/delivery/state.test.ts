import { describe, it, expect } from "vitest";
import { canTransition, DELIVERY_TRANSITIONS } from "./state.js";

describe("canTransition", () => {
  it("allows the forward delivery flow", () => {
    expect(canTransition("PENDING", "SCHEDULED")).toBe(true);
    expect(canTransition("SCHEDULED", "IN_TRANSIT")).toBe(true);
    expect(canTransition("IN_TRANSIT", "DELIVERED")).toBe(true);
  });

  it("rejects an illegal jump", () => {
    expect(canTransition("PENDING", "DELIVERED")).toBe(false);
    expect(canTransition("SCHEDULED", "DELIVERED")).toBe(false);
  });

  it("allows the failure and retry branches", () => {
    expect(canTransition("IN_TRANSIT", "FAILED")).toBe(true);
    expect(canTransition("FAILED", "SCHEDULED")).toBe(true);
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
  });

  it("treats DELIVERED and CANCELLED as terminal", () => {
    expect(DELIVERY_TRANSITIONS.DELIVERED).toHaveLength(0);
    expect(DELIVERY_TRANSITIONS.CANCELLED).toHaveLength(0);
    expect(canTransition("DELIVERED", "IN_TRANSIT")).toBe(false);
  });
});
