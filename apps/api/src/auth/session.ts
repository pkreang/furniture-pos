import { randomBytes, createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

const sessionUserInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
} satisfies Prisma.UserInclude;

export type SessionUser = Prisma.UserGetPayload<{ include: typeof sessionUserInclude }>;

export async function findSessionUser(token: string): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: sessionUserInclude } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session.user;
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
