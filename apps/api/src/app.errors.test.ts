import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("error handlers", () => {
  it("returns a structured 404 for an unknown route", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/does-not-exist" });
    await app.close();
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  it("normalises a schema validation failure to a structured 400", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {},
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION");
  });
});
