import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./password.js";

/**
 * On API boot, if both RESET_USER_USERNAME and RESET_USER_PASSWORD are set,
 * resets that user's password to the new value and forces them to change it
 * on first login. Designed as the last-resort unblock for a forgotten owner
 * password: operator sets the env vars in the host dashboard, restart picks
 * them up, operator unsets them after logging in.
 *
 * If only one env var is set, or neither, this is a no-op. If both are set
 * but the username doesn't exist, logs a warning and continues — the API
 * still boots so the operator can fix the typo without redeploying.
 */
export async function runBootstrapResets(prisma: PrismaClient): Promise<void> {
  const username = process.env.RESET_USER_USERNAME;
  const password = process.env.RESET_USER_PASSWORD;
  if (!username || !password) return;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.warn(
      `[bootstrap] RESET_USER_USERNAME="${username}" set but no such user exists — skipping`,
    );
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    },
  });
  console.log(
    `[bootstrap] reset password for user "${username}" — REMOVE RESET_USER_* env vars after first login`,
  );
}
