import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("s3cret-pw");
    expect(await verifyPassword(hash, "s3cret-pw")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3cret-pw");
    expect(await verifyPassword(hash, "wrong-pw")).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same-pw");
    const b = await hashPassword("same-pw");
    expect(a).not.toBe(b);
  });
});
