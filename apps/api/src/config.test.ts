import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("reads the database url and applies defaults", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://x" });
    expect(config.databaseUrl).toBe("postgresql://x");
    expect(config.port).toBe(3000);
    expect(config.isProduction).toBe(false);
  });

  it("honours NODE_ENV and API_PORT", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://x",
      NODE_ENV: "production",
      API_PORT: "8080",
    });
    expect(config.isProduction).toBe(true);
    expect(config.port).toBe(8080);
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
