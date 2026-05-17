import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { createSession, findSessionUser, revokeSession, hashToken } from "./session.js";

async function makeUser(): Promise<number> {
  const role = await prisma.role.create({ data: { key: "r", name: "R" } });
  const user = await prisma.user.create({
    data: { username: "u", passwordHash: "h", name: "U", roleId: role.id },
  });
  return user.id;
}

describe("session service", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a session and resolves the token back to the user", async () => {
    const userId = await makeUser();
    const token = await createSession(userId);

    const user = await findSessionUser(token);
    expect(user?.id).toBe(userId);
  });

  it("stores only the hashed token, never the raw token", async () => {
    const userId = await makeUser();
    const token = await createSession(userId);

    const row = await prisma.session.findFirstOrThrow();
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
  });

  it("returns null for a revoked session", async () => {
    const userId = await makeUser();
    const token = await createSession(userId);
    await revokeSession(token);

    expect(await findSessionUser(token)).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const userId = await makeUser();
    const token = await createSession(userId);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await findSessionUser(token)).toBeNull();
  });
});
