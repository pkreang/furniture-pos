import { execSync } from "node:child_process";

export function setup(): void {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) throw new Error("DATABASE_URL_TEST is not set");
  execSync("npx prisma migrate deploy", {
    cwd: new URL(".", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  });
}
