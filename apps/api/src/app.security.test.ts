import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("security headers", () => {
  it("sets standard hardening headers on responses", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});
