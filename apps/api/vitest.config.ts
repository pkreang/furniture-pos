import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Test files share one PostgreSQL database and wipe tables in beforeEach,
    // so they must run one at a time rather than in parallel workers.
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
    },
  },
});
