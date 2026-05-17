# Phase 2: Auth & RBAC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-enforced authentication (argon2 + DB-backed sessions) and role-based access control to the POS, plus the management UI for users, roles/permissions, and branches.

**Architecture:** Passwords are hashed with argon2. Login issues an opaque random token stored (SHA-256 hashed) in a `sessions` table and returned as an `httpOnly` cookie. A Fastify `authenticate` preHandler resolves the session into `request.user` (with the role's permission keys); a `requirePermission(key)` preHandler gates every protected route and also blocks users who still must change their password. Roles flagged `isBranchScoped` (manager, cashier) have their list queries filtered to the user's own `branchId` server-side, regardless of client input. The Vue app gains an auth Pinia store, router guards, a login / forced-password-change flow, and management screens.

**Tech Stack:** argon2, @fastify/cookie, @fastify/rate-limit, Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, vue-router 4, Pinia 2, Vitest. Builds on the Phase 1 foundation.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md` (§4.3, §8.4)

---

## File Structure

After this phase the API and web apps gain:

```
apps/api/
  prisma/schema.prisma          + Role, Permission, RolePermission, User, Session models
  src/
    auth/
      password.ts               argon2 hash/verify
      session.ts                create/find/revoke sessions (opaque token, sha256-hashed at rest)
      plugin.ts                 Fastify plugin: cookie, rate-limit, authenticate + requirePermission decorators
      branch-scope.ts           branchFilter() helper for branch-scoped roles
      password.test.ts, session.test.ts, branch-scope.test.ts
    auth/routes.ts               POST /api/auth/login | logout | change-password, GET /api/auth/me
    auth/routes.test.ts
    routes/
      users.ts                  GET/POST/PATCH /api/users  (+ deactivate)
      roles.ts                  GET /api/roles, GET /api/permissions, PUT /api/roles/:id/permissions
      branches.ts               (Phase 1) + POST/PATCH, route now RBAC-protected
      users.test.ts, roles.test.ts, branches.test.ts (updated)
    seed/
      catalog.ts                permission catalog + role definitions (data only)
      index.ts                  runSeed() — idempotent upsert of permissions/roles/admin
      index.test.ts
    test-helpers/
      auth.ts                   seedRole/createTestUser/sessionCookie helpers for API tests
    types/fastify.d.ts           FastifyRequest.user augmentation
apps/web/
  src/
    api/client.ts                + apiSend (POST/PATCH/PUT/DELETE)
    api/auth.ts, api/users.ts, api/roles.ts, api/branches.ts
    stores/auth.ts               current user, login/logout, hasPermission
    stores/user.ts, stores/role.ts
    router/index.ts              guards + new routes
    App.vue                      app shell: nav + current user + logout (updated)
    views/
      LoginView.vue
      ChangePasswordView.vue
      UserListView.vue, UserFormView.vue
      RoleListView.vue, RolePermissionsView.vue
      BranchListView.vue (updated), BranchFormView.vue
    stores/auth.test.ts
```

---

## Task 1: Prisma schema — Role, Permission, RolePermission, User, Session

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add the five models and a `Branch` back-relation to `apps/api/prisma/schema.prisma`**

Append these models to the file, and add the single `users Branch[]`-side relation line to the existing `Branch` model.

In the existing `Branch` model, add this line (after `createdAt`):
```prisma
  users       User[]
```

Append:
```prisma
model Role {
  id                 Int      @id @default(autoincrement())
  key                String   @unique
  name               String
  isBranchScoped     Boolean  @default(false) @map("is_branch_scoped")
  discountMaxPercent Int?     @map("discount_max_percent")
  createdAt          DateTime @default(now()) @map("created_at")

  permissions RolePermission[]
  users       User[]

  @@map("roles")
}

model Permission {
  id          Int    @id @default(autoincrement())
  key         String @unique
  description String

  roles RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId       Int @map("role_id")
  permissionId Int @map("permission_id")

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model User {
  id                 Int      @id @default(autoincrement())
  username           String   @unique
  passwordHash       String   @map("password_hash")
  name               String
  roleId             Int      @map("role_id")
  branchId           Int?     @map("branch_id")
  isActive           Boolean  @default(true) @map("is_active")
  mustChangePassword Boolean  @default(true) @map("must_change_password")
  createdAt          DateTime @default(now()) @map("created_at")

  role     Role      @relation(fields: [roleId], references: [id])
  branch   Branch?   @relation(fields: [branchId], references: [id])
  sessions Session[]

  @@map("users")
}

model Session {
  id        Int      @id @default(autoincrement())
  tokenHash String   @unique @map("token_hash")
  userId    Int      @map("user_id")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

- [ ] **Step 2: Create the migration against the live dev database**

The dev PostgreSQL container must be running (`npm run db:up`). Run:
```bash
cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name auth_rbac && cd ../..
```
Expected: a new folder `apps/api/prisma/migrations/<timestamp>_auth_rbac/` is created and the output ends with `Your database is now in sync with your schema`.

- [ ] **Step 3: Verify the Prisma client regenerated**

Run: `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma generate && cd ../..`
Expected: `Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): add Role, Permission, User, Session models and migration"
```

---

## Task 2: Password hashing utility (argon2) — TDD

**Files:**
- Modify: `apps/api/package.json` (add `argon2`)
- Create: `apps/api/src/auth/password.ts`
- Test: `apps/api/src/auth/password.test.ts`

- [ ] **Step 1: Add `argon2` to `apps/api/package.json` dependencies and install**

Add to `dependencies`: `"argon2": "^0.41.1"`. Then run `npm install`.
Expected: completes without error.

- [ ] **Step 2: Write the failing test — `apps/api/src/auth/password.test.ts`**

```typescript
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: FAIL — cannot resolve `./password.js`.

- [ ] **Step 4: Create `apps/api/src/auth/password.ts`**

```typescript
import argon2 from "argon2";

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the three password tests pass alongside the existing tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/password.ts apps/api/src/auth/password.test.ts apps/api/package.json package-lock.json
git commit -m "feat(api): add argon2 password hashing utility"
```

---

## Task 3: Seed script — permission catalog, roles, admin user

**Files:**
- Create: `apps/api/src/seed/catalog.ts`, `apps/api/src/seed/index.ts`
- Test: `apps/api/src/seed/index.test.ts`
- Modify: `apps/api/package.json` (add `prisma.seed` config), `.env.example`, `.env`

- [ ] **Step 1: Add the admin seed vars to `.env.example` and `.env`**

Append to BOTH `.env.example` and `.env`:
```
# Seed admin account (used by `prisma db seed`)
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=change_me_on_first_login
```

- [ ] **Step 2: Add the `prisma.seed` config to `apps/api/package.json`**

Add this top-level key to `apps/api/package.json` (sibling of `scripts`):
```json
"prisma": {
  "seed": "tsx src/seed/index.ts"
}
```

- [ ] **Step 3: Create the data catalog — `apps/api/src/seed/catalog.ts`**

```typescript
export interface PermissionDef {
  key: string;
  description: string;
}

export interface RoleDef {
  key: string;
  name: string;
  isBranchScoped: boolean;
  discountMaxPercent: number | null;
  permissions: string[];
}

export const PERMISSIONS: PermissionDef[] = [
  { key: "users.view", description: "ดูรายชื่อผู้ใช้" },
  { key: "users.manage", description: "เพิ่ม/แก้ไข/ปิดบัญชีผู้ใช้" },
  { key: "roles.view", description: "ดูบทบาทและสิทธิ์" },
  { key: "roles.manage", description: "แก้ไขสิทธิ์ของบทบาท" },
  { key: "branches.view", description: "ดูรายชื่อสาขา" },
  { key: "branches.manage", description: "เพิ่ม/แก้ไขสาขา" },
];

const ALL = PERMISSIONS.map((p) => p.key);

export const ROLES: RoleDef[] = [
  { key: "owner", name: "เจ้าของ", isBranchScoped: false, discountMaxPercent: null, permissions: ALL },
  { key: "admin", name: "ผู้ดูแลระบบ", isBranchScoped: false, discountMaxPercent: null, permissions: ALL },
  { key: "manager", name: "ผู้จัดการสาขา", isBranchScoped: true, discountMaxPercent: 15, permissions: ["users.view", "branches.view"] },
  { key: "cashier", name: "พนักงานขาย", isBranchScoped: true, discountMaxPercent: 5, permissions: ["branches.view"] },
  { key: "account", name: "บัญชี", isBranchScoped: false, discountMaxPercent: 0, permissions: ["users.view", "branches.view"] },
];
```

- [ ] **Step 4: Create the seed runner — `apps/api/src/seed/index.ts`**

```typescript
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../auth/password.js";
import { PERMISSIONS, ROLES } from "./catalog.js";

export async function runSeed(prisma: PrismaClient): Promise<void> {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    });
  }

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, isBranchScoped: r.isBranchScoped, discountMaxPercent: r.discountMaxPercent },
      create: { key: r.key, name: r.name, isBranchScoped: r.isBranchScoped, discountMaxPercent: r.discountMaxPercent },
    });
    for (const permKey of r.permissions) {
      const perm = await prisma.permission.findUniqueOrThrow({ where: { key: permKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("SEED_ADMIN_PASSWORD is not set");
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "admin" } });
  await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash: await hashPassword(password),
      name: "ผู้ดูแลระบบ",
      roleId: adminRole.id,
      mustChangePassword: true,
    },
  });
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await runSeed(prisma);
    console.log("Seed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (e.g. via `prisma db seed`), not when imported by tests.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Write the failing test — `apps/api/src/seed/index.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma.js";
import { runSeed } from "./index.js";
import { PERMISSIONS, ROLES } from "./catalog.js";

describe("runSeed", () => {
  beforeEach(async () => {
    process.env.SEED_ADMIN_USERNAME = "admin";
    process.env.SEED_ADMIN_PASSWORD = "seed-test-pw";
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates every permission and role with its permission set", async () => {
    await runSeed(prisma);

    expect(await prisma.permission.count()).toBe(PERMISSIONS.length);
    expect(await prisma.role.count()).toBe(ROLES.length);

    const owner = await prisma.role.findUniqueOrThrow({
      where: { key: "owner" },
      include: { permissions: true },
    });
    expect(owner.permissions).toHaveLength(PERMISSIONS.length);

    const cashier = await prisma.role.findUniqueOrThrow({
      where: { key: "cashier" },
      include: { permissions: true },
    });
    expect(cashier.isBranchScoped).toBe(true);
    expect(cashier.permissions).toHaveLength(1);
  });

  it("creates an admin user that must change password, and is idempotent", async () => {
    await runSeed(prisma);
    await runSeed(prisma); // second run must not duplicate or throw

    const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
    expect(admin.mustChangePassword).toBe(true);
    expect(admin.passwordHash).not.toBe("seed-test-pw");
    expect(await prisma.user.count()).toBe(1);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails, then passes**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
The seed test file exists and `runSeed` is implemented, so this should PASS on first run. If it fails for an unrelated reason, fix before continuing.

- [ ] **Step 7: Apply the seed to the dev database**

Run: `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" SEED_ADMIN_USERNAME="$(grep '^SEED_ADMIN_USERNAME=' ../../.env | cut -d= -f2-)" SEED_ADMIN_PASSWORD="$(grep '^SEED_ADMIN_PASSWORD=' ../../.env | cut -d= -f2-)" npx prisma db seed && cd ../..`
Expected: `Seed complete.`

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/seed apps/api/package.json package-lock.json .env.example
git commit -m "feat(api): seed permissions, roles, and admin user"
```

---

## Task 4: Session service — TDD

**Files:**
- Create: `apps/api/src/auth/session.ts`
- Test: `apps/api/src/auth/session.test.ts`

- [ ] **Step 1: Write the failing test — `apps/api/src/auth/session.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: FAIL — cannot resolve `./session.js`.

- [ ] **Step 3: Create `apps/api/src/auth/session.ts`**

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the four session tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/session.ts apps/api/src/auth/session.test.ts
git commit -m "feat(api): add DB-backed session service"
```

---

## Task 5: Auth plugin and login/logout/me routes — TDD

**Files:**
- Modify: `apps/api/package.json` (add `@fastify/cookie`, `@fastify/rate-limit`), `apps/api/src/app.ts`
- Create: `apps/api/src/types/fastify.d.ts`, `apps/api/src/auth/plugin.ts`, `apps/api/src/auth/routes.ts`
- Test: `apps/api/src/auth/routes.test.ts`

- [ ] **Step 1: Add the Fastify plugins and install**

Add to `apps/api/package.json` dependencies: `"@fastify/cookie": "^9.4.0"` and `"@fastify/rate-limit": "^9.1.0"`. Run `npm install`.
Expected: completes without error.

- [ ] **Step 2: Create the request-type augmentation — `apps/api/src/types/fastify.d.ts`**

```typescript
import "fastify";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  roleKey: string;
  branchId: number | null;
  isBranchScoped: boolean;
  discountMaxPercent: number | null;
  permissions: string[];
  mustChangePassword: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    sessionToken?: string;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      key: string,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
```

- [ ] **Step 3: Create the auth plugin — `apps/api/src/auth/plugin.ts`**

```typescript
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { findSessionUser } from "./session.js";
import type { AuthUser } from "../types/fastify.js";

export const SESSION_COOKIE = "fh_session";

async function authPlugin(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.decorateRequest("user", undefined);
  app.decorateRequest("sessionToken", undefined);

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const token = request.cookies[SESSION_COOKIE];
      const sessionUser = token ? await findSessionUser(token) : null;
      if (!token || !sessionUser || !sessionUser.isActive) {
        await reply.code(401).send({ code: "UNAUTHENTICATED", message: "ต้องเข้าสู่ระบบ" });
        return;
      }
      const user: AuthUser = {
        id: sessionUser.id,
        username: sessionUser.username,
        name: sessionUser.name,
        roleKey: sessionUser.role.key,
        branchId: sessionUser.branchId,
        isBranchScoped: sessionUser.role.isBranchScoped,
        discountMaxPercent: sessionUser.role.discountMaxPercent,
        permissions: sessionUser.role.permissions.map((rp) => rp.permission.key),
        mustChangePassword: sessionUser.mustChangePassword,
      };
      request.user = user;
      request.sessionToken = token;
    },
  );

  app.decorate("requirePermission", (key: string) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const user = request.user;
      if (!user) {
        await reply.code(401).send({ code: "UNAUTHENTICATED", message: "ต้องเข้าสู่ระบบ" });
        return;
      }
      if (user.mustChangePassword) {
        await reply
          .code(403)
          .send({ code: "MUST_CHANGE_PASSWORD", message: "ต้องเปลี่ยนรหัสผ่านก่อน" });
        return;
      }
      if (!user.permissions.includes(key)) {
        await reply.code(403).send({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์เข้าถึง" });
        return;
      }
    };
  });
}

export default fp(authPlugin);
```

> Note: `fastify-plugin` (`fp`) ships as a dependency of Fastify, so no extra install is needed. It is what lets `decorate`/`decorateRequest` calls escape the plugin's encapsulation so routes registered elsewhere can use `app.authenticate`.

- [ ] **Step 4: Create the auth routes — `apps/api/src/auth/routes.ts`**

```typescript
import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { verifyPassword, hashPassword } from "./password.js";
import { createSession, revokeSession } from "./session.js";
import { SESSION_COOKIE } from "./plugin.js";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/auth/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body as { username: string; password: string };
      const user = await prisma.user.findUnique({ where: { username } });
      const ok = user && user.isActive && (await verifyPassword(user.passwordHash, password));
      if (!user || !ok) {
        return reply
          .code(401)
          .send({ code: "INVALID_CREDENTIALS", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }
      const token = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
      return { id: user.id, username: user.username, name: user.name, mustChangePassword: user.mustChangePassword };
    },
  );

  app.post("/api/auth/logout", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.sessionToken) await revokeSession(request.sessionToken);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    return request.user;
  });
}
```

- [ ] **Step 5: Register the plugin and routes in `apps/api/src/app.ts`**

Replace the contents of `apps/api/src/app.ts` with:
```typescript
import Fastify, { type FastifyInstance } from "fastify";
import authPlugin from "./auth/plugin.js";
import { authRoutes } from "./auth/routes.js";
import { branchRoutes } from "./routes/branches.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(branchRoutes);

  return app;
}
```

> **Plugin order matters:** `authPlugin` is registered before the route plugins. Fastify executes registered plugins in order at startup, and `authPlugin` is wrapped in `fastify-plugin`, so its `authenticate` / `requirePermission` decorators land on the root instance and are available by the time `authRoutes` and `branchRoutes` run. `buildApp` stays **synchronous** — `app.inject()` (in tests) and `app.listen()` (in `server.ts`) both trigger plugin execution — so the Phase 1 `server.ts`, `app.test.ts`, and `branches.test.ts` need no change for the signature.

- [ ] **Step 6: Write the failing test — `apps/api/src/auth/routes.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { hashPassword } from "./password.js";

async function makeUser(opts: { password: string; isActive?: boolean }): Promise<void> {
  const role = await prisma.role.create({ data: { key: "admin", name: "Admin" } });
  await prisma.user.create({
    data: {
      username: "alice",
      passwordHash: await hashPassword(opts.password),
      name: "Alice",
      roleId: role.id,
      isActive: opts.isActive ?? true,
      mustChangePassword: false,
    },
  });
}

describe("auth routes", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects login with wrong credentials", async () => {
    await makeUser({ password: "correct-pw" });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "wrong-pw" },
    });
    await app.close();
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in, sets a session cookie, and resolves /api/auth/me", async () => {
    await makeUser({ password: "correct-pw" });
    const app = buildApp();

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "correct-pw" },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.cookies.find((c) => c.name === "fh_session");
    expect(cookie?.httpOnly).toBe(true);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { fh_session: cookie!.value },
    });
    await app.close();
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe("alice");
  });

  it("rejects /api/auth/me without a session cookie", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    await app.close();
    expect(res.statusCode).toBe(401);
  });

  it("logout revokes the session", async () => {
    await makeUser({ password: "correct-pw" });
    const app = buildApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "correct-pw" },
    });
    const token = login.cookies.find((c) => c.name === "fh_session")!.value;

    await app.inject({ method: "POST", url: "/api/auth/logout", cookies: { fh_session: token } });
    const me = await app.inject({ method: "GET", url: "/api/auth/me", cookies: { fh_session: token } });
    await app.close();
    expect(me.statusCode).toBe(401);
  });
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the auth-route tests pass and the Phase 1 `app.test.ts` / `branches.test.ts` still pass unchanged.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src apps/api/package.json package-lock.json
git commit -m "feat(api): add auth plugin and login/logout/me routes"
```

---

## Task 6: RBAC-protect GET /api/branches + shared test helpers — TDD

**Files:**
- Create: `apps/api/src/test-helpers/auth.ts`
- Modify: `apps/api/src/routes/branches.ts`, `apps/api/src/routes/branches.test.ts`

- [ ] **Step 1: Create the shared API test helper — `apps/api/src/test-helpers/auth.ts`**

```typescript
import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";
import { createSession } from "../auth/session.js";

interface TestUserOpts {
  username?: string;
  roleKey?: string;
  permissions?: string[];
  isBranchScoped?: boolean;
  branchId?: number | null;
  mustChangePassword?: boolean;
}

/** Creates a role (with the given permissions) and a user, returning the user id. */
export async function createTestUser(opts: TestUserOpts = {}): Promise<number> {
  const roleKey = opts.roleKey ?? "tester";
  const role = await prisma.role.create({
    data: { key: roleKey, name: roleKey, isBranchScoped: opts.isBranchScoped ?? false },
  });
  for (const key of opts.permissions ?? []) {
    const perm = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  const user = await prisma.user.create({
    data: {
      username: opts.username ?? "tester",
      passwordHash: await hashPassword("pw"),
      name: opts.username ?? "tester",
      roleId: role.id,
      branchId: opts.branchId ?? null,
      mustChangePassword: opts.mustChangePassword ?? false,
    },
  });
  return user.id;
}

/** Creates a session for a user id and returns the cookie map for `app.inject`. */
export async function sessionCookie(userId: number): Promise<{ fh_session: string }> {
  return { fh_session: await createSession(userId) };
}

/** Deletes all auth + branch rows. Call in `beforeEach`. */
export async function resetAuthTables(): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.branch.deleteMany();
}
```

- [ ] **Step 2: Protect the route in `apps/api/src/routes/branches.ts`**

```typescript
import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function branchRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/branches",
    { preHandler: [app.authenticate, app.requirePermission("branches.view")] },
    async () => {
      return prisma.branch.findMany({ orderBy: { id: "asc" } });
    },
  );
}
```

- [ ] **Step 3: Replace `apps/api/src/routes/branches.test.ts` with the RBAC-aware version**

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("GET /api/branches", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated request", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/branches" });
    await app.close();
    expect(res.statusCode).toBe(401);
  });

  it("rejects a user without branches.view", async () => {
    const userId = await createTestUser({ permissions: [] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/branches",
      cookies: await sessionCookie(userId),
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("returns all branches ordered by id for an authorised user", async () => {
    await prisma.branch.create({ data: { name: "สาขาสยาม", code: "BKK01" } });
    await prisma.branch.create({ data: { name: "คลังกลาง", code: "WH01", isWarehouse: true } });
    const userId = await createTestUser({ permissions: ["branches.view"] });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/branches",
      cookies: await sessionCookie(userId),
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].code).toBe("BKK01");
    expect(body[1].isWarehouse).toBe(true);
  });
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the three branch tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): RBAC-protect GET /api/branches; add API test helpers"
```

---

## Task 7: Change-password route + first-login enforcement — TDD

**Files:**
- Modify: `apps/api/src/auth/routes.ts`
- Test: `apps/api/src/auth/routes.test.ts` (add cases)

- [ ] **Step 1: Add the change-password route to `apps/api/src/auth/routes.ts`**

Add this route inside `authRoutes`, after the `/api/auth/me` route. Also add the import of `hashPassword` if not already present (it is imported in Task 5's version):

```typescript
  app.post(
    "/api/auth/change-password",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 1 },
            newPassword: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.id } });
      if (!(await verifyPassword(user.passwordHash, currentPassword))) {
        return reply
          .code(400)
          .send({ code: "INVALID_CREDENTIALS", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
      });
      return { ok: true };
    },
  );
```

- [ ] **Step 2: Add change-password test cases to `apps/api/src/auth/routes.test.ts`**

First, add this import line to the existing import block at the **top** of `apps/api/src/auth/routes.test.ts` (alongside the imports added in Task 5):

```typescript
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";
```

Then append this `describe` block at the end of the file (it reuses the existing `describe`/`it`/`expect`/`beforeEach` imports from `vitest` and `buildApp`/`prisma`):

```typescript
describe("POST /api/auth/change-password", () => {
  beforeEach(resetAuthTables);

  it("blocks protected routes until the password is changed", async () => {
    const userId = await createTestUser({ permissions: ["branches.view"], mustChangePassword: true });
    const app = buildApp();
    const cookies = await sessionCookie(userId);

    const before = await app.inject({ method: "GET", url: "/api/branches", cookies });
    expect(before.statusCode).toBe(403);
    expect(before.json().code).toBe("MUST_CHANGE_PASSWORD");

    const change = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies,
      payload: { currentPassword: "pw", newPassword: "brand-new-pw" },
    });
    expect(change.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/api/branches", cookies });
    await app.close();
    expect(after.statusCode).toBe(200);
  });

  it("rejects a wrong current password", async () => {
    const userId = await createTestUser({ mustChangePassword: true });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: await sessionCookie(userId),
      payload: { currentPassword: "not-pw", newPassword: "brand-new-pw" },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
  });
});
```

> Note: the existing `auth routes` describe block in this file uses its own `makeUser`/cleanup; this new block uses the shared helpers. Both clean the same tables, so they coexist.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the new change-password tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/routes.ts apps/api/src/auth/routes.test.ts
git commit -m "feat(api): add change-password route and first-login enforcement"
```

---

## Task 8: Branch-scoping helper — TDD

**Files:**
- Create: `apps/api/src/auth/branch-scope.ts`
- Test: `apps/api/src/auth/branch-scope.test.ts`

- [ ] **Step 1: Write the failing test — `apps/api/src/auth/branch-scope.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { branchFilter } from "./branch-scope.js";
import type { AuthUser } from "../types/fastify.js";

function user(partial: Partial<AuthUser>): AuthUser {
  return {
    id: 1,
    username: "u",
    name: "U",
    roleKey: "r",
    branchId: null,
    isBranchScoped: false,
    discountMaxPercent: null,
    permissions: [],
    mustChangePassword: false,
    ...partial,
  };
}

describe("branchFilter", () => {
  it("returns an empty filter for a non-branch-scoped user", () => {
    expect(branchFilter(user({ isBranchScoped: false }))).toEqual({});
  });

  it("forces the user's own branchId for a branch-scoped user", () => {
    expect(branchFilter(user({ isBranchScoped: true, branchId: 4 }))).toEqual({ branchId: 4 });
  });

  it("throws if a branch-scoped user has no branch assigned", () => {
    expect(() => branchFilter(user({ isBranchScoped: true, branchId: null }))).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: FAIL — cannot resolve `./branch-scope.js`.

- [ ] **Step 3: Create `apps/api/src/auth/branch-scope.ts`**

```typescript
import type { AuthUser } from "../types/fastify.js";

/**
 * Returns a Prisma `where` fragment that restricts a query to the user's own
 * branch when their role is branch-scoped. For unscoped roles it returns `{}`.
 * The fragment must always be spread into queries server-side — never trust a
 * client-supplied branch id.
 */
export function branchFilter(user: AuthUser): { branchId?: number } {
  if (!user.isBranchScoped) return {};
  if (user.branchId == null) {
    throw new Error(`branch-scoped user ${user.id} has no branch assigned`);
  }
  return { branchId: user.branchId };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the three branch-scope tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/branch-scope.ts apps/api/src/auth/branch-scope.test.ts
git commit -m "feat(api): add branch-scoping filter helper"
```

---

## Task 9: Users CRUD routes — TDD

**Files:**
- Create: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/routes/users.test.ts`

- [ ] **Step 1: Write the failing test — `apps/api/src/routes/users.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("users routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists users for a user with users.view", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["users.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users",
      cookies: await sessionCookie(adminId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().some((u: { username: string }) => u.username === "admin")).toBe(true);
    expect(res.json()[0].passwordHash).toBeUndefined();
  });

  it("creates a user with users.manage and a hashed password", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["users.manage"] });
    const role = await prisma.role.findFirstOrThrow();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      cookies: await sessionCookie(adminId),
      payload: { username: "bob", name: "Bob", password: "bob-initial-pw", roleId: role.id },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    const bob = await prisma.user.findUniqueOrThrow({ where: { username: "bob" } });
    expect(bob.passwordHash).not.toBe("bob-initial-pw");
    expect(bob.mustChangePassword).toBe(true);
  });

  it("rejects creating a user without users.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["users.view"] });
    const role = await prisma.role.findFirstOrThrow();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      cookies: await sessionCookie(viewerId),
      payload: { username: "bob", name: "Bob", password: "bob-initial-pw", roleId: role.id },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("updates and deactivates a user with users.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["users.manage"] });
    const targetId = await createTestUser({ username: "target", roleKey: "other" });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/users/${targetId}`,
      cookies: await sessionCookie(adminId),
      payload: { name: "Renamed", isActive: false },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    expect(updated.name).toBe("Renamed");
    expect(updated.isActive).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: FAIL — route `/api/users` returns 404.

- [ ] **Step 3: Create `apps/api/src/routes/users.ts`**

```typescript
import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";
import { branchFilter } from "../auth/branch-scope.js";

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  name: true,
  roleId: true,
  branchId: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/users",
    { preHandler: [app.authenticate, app.requirePermission("users.view")] },
    async (request) => {
      return prisma.user.findMany({
        where: branchFilter(request.user!),
        select: PUBLIC_USER_SELECT,
        orderBy: { id: "asc" },
      });
    },
  );

  app.post(
    "/api/users",
    {
      preHandler: [app.authenticate, app.requirePermission("users.manage")],
      schema: {
        body: {
          type: "object",
          required: ["username", "name", "password", "roleId"],
          properties: {
            username: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 8 },
            roleId: { type: "integer" },
            branchId: { type: ["integer", "null"] },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        username: string;
        name: string;
        password: string;
        roleId: number;
        branchId?: number | null;
      };
      const user = await prisma.user.create({
        data: {
          username: body.username,
          name: body.name,
          passwordHash: await hashPassword(body.password),
          roleId: body.roleId,
          branchId: body.branchId ?? null,
          mustChangePassword: true,
        },
        select: PUBLIC_USER_SELECT,
      });
      return reply.code(201).send(user);
    },
  );

  app.patch(
    "/api/users/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("users.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            roleId: { type: "integer" },
            branchId: { type: ["integer", "null"] },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const id = Number((request.params as { id: string }).id);
      return prisma.user.update({
        where: { id },
        data: request.body as Record<string, unknown>,
        select: PUBLIC_USER_SELECT,
      });
    },
  );
}
```

- [ ] **Step 4: Register the route in `apps/api/src/app.ts`**

Add the import `import { userRoutes } from "./routes/users.js";` and add `await app.register(userRoutes);` after the `branchRoutes` registration.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the four user-route tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): add users CRUD routes with RBAC and branch scoping"
```

---

## Task 10: Roles & permissions routes — TDD

**Files:**
- Create: `apps/api/src/routes/roles.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/routes/roles.test.ts`

- [ ] **Step 1: Write the failing test — `apps/api/src/routes/roles.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";

describe("roles routes", () => {
  beforeEach(resetAuthTables);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists roles with their permission keys for a user with roles.view", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["roles.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/roles",
      cookies: await sessionCookie(adminId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const tester = res.json().find((r: { key: string }) => r.key === "admin");
    expect(tester.permissionKeys).toContain("roles.view");
  });

  it("lists the full permission catalog", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["roles.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/permissions",
      cookies: await sessionCookie(adminId),
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().some((p: { key: string }) => p.key === "roles.view")).toBe(true);
  });

  it("replaces a role's permissions with roles.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["roles.manage"] });
    await prisma.permission.createMany({
      data: [
        { key: "branches.view", description: "x" },
        { key: "branches.manage", description: "y" },
      ],
      skipDuplicates: true,
    });
    const target = await prisma.role.create({ data: { key: "editme", name: "Edit Me" } });
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/roles/${target.id}/permissions`,
      cookies: await sessionCookie(adminId),
      payload: { permissionKeys: ["branches.view", "branches.manage"] },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    const after = await prisma.rolePermission.count({ where: { roleId: target.id } });
    expect(after).toBe(2);
  });

  it("rejects editing role permissions without roles.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["roles.view"] });
    const target = await prisma.role.create({ data: { key: "editme", name: "Edit Me" } });
    const app = buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/roles/${target.id}/permissions`,
      cookies: await sessionCookie(viewerId),
      payload: { permissionKeys: [] },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: FAIL — route `/api/roles` returns 404.

- [ ] **Step 3: Create `apps/api/src/routes/roles.ts`**

```typescript
import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function roleRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/roles",
    { preHandler: [app.authenticate, app.requirePermission("roles.view")] },
    async () => {
      const roles = await prisma.role.findMany({
        include: { permissions: { include: { permission: true } } },
        orderBy: { id: "asc" },
      });
      return roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        isBranchScoped: r.isBranchScoped,
        discountMaxPercent: r.discountMaxPercent,
        permissionKeys: r.permissions.map((rp) => rp.permission.key),
      }));
    },
  );

  app.get(
    "/api/permissions",
    { preHandler: [app.authenticate, app.requirePermission("roles.view")] },
    async () => {
      return prisma.permission.findMany({ orderBy: { key: "asc" } });
    },
  );

  app.put(
    "/api/roles/:id/permissions",
    {
      preHandler: [app.authenticate, app.requirePermission("roles.manage")],
      schema: {
        body: {
          type: "object",
          required: ["permissionKeys"],
          properties: {
            permissionKeys: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      const roleId = Number((request.params as { id: string }).id);
      const { permissionKeys } = request.body as { permissionKeys: string[] };
      const perms = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
      if (perms.length !== permissionKeys.length) {
        return reply.code(400).send({ code: "UNKNOWN_PERMISSION", message: "พบสิทธิ์ที่ไม่รู้จัก" });
      }
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId } }),
        prisma.rolePermission.createMany({
          data: perms.map((p) => ({ roleId, permissionId: p.id })),
        }),
      ]);
      return { ok: true };
    },
  );
}
```

- [ ] **Step 4: Register the route in `apps/api/src/app.ts`**

Add the import `import { roleRoutes } from "./routes/roles.js";` and add `await app.register(roleRoutes);` after the `userRoutes` registration.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the four role-route tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): add roles and permissions routes"
```

---

## Task 11: Branch create/update routes — TDD

**Files:**
- Modify: `apps/api/src/routes/branches.ts`, `apps/api/src/routes/branches.test.ts`

- [ ] **Step 1: Add create/update routes to `apps/api/src/routes/branches.ts`**

Add these two routes inside `branchRoutes`, after the existing `GET`:

```typescript
  app.post(
    "/api/branches",
    {
      preHandler: [app.authenticate, app.requirePermission("branches.manage")],
      schema: {
        body: {
          type: "object",
          required: ["name", "code"],
          properties: {
            name: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 1 },
            isWarehouse: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { name: string; code: string; isWarehouse?: boolean };
      const branch = await prisma.branch.create({
        data: { name: body.name, code: body.code, isWarehouse: body.isWarehouse ?? false },
      });
      return reply.code(201).send(branch);
    },
  );

  app.patch(
    "/api/branches/:id",
    {
      preHandler: [app.authenticate, app.requirePermission("branches.manage")],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 1 },
            isWarehouse: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const id = Number((request.params as { id: string }).id);
      return prisma.branch.update({
        where: { id },
        data: request.body as Record<string, unknown>,
      });
    },
  );
```

- [ ] **Step 2: Add create/update test cases to `apps/api/src/routes/branches.test.ts`**

Add these cases inside the existing `describe("GET /api/branches", ...)` block — or add a sibling `describe` after it (reusing the same imports). Use a sibling block:

```typescript
describe("POST/PATCH /api/branches", () => {
  beforeEach(resetAuthTables);

  it("creates a branch with branches.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["branches.manage"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/branches",
      cookies: await sessionCookie(adminId),
      payload: { name: "สาขาใหม่", code: "NEW01" },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    expect(res.json().code).toBe("NEW01");
  });

  it("rejects creating a branch without branches.manage", async () => {
    const viewerId = await createTestUser({ username: "viewer", permissions: ["branches.view"] });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/branches",
      cookies: await sessionCookie(viewerId),
      payload: { name: "สาขาใหม่", code: "NEW01" },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it("updates a branch with branches.manage", async () => {
    const adminId = await createTestUser({ username: "admin", permissions: ["branches.manage"] });
    const branch = await prisma.branch.create({ data: { name: "เดิม", code: "OLD01" } });
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/branches/${branch.id}`,
      cookies: await sessionCookie(adminId),
      payload: { name: "ใหม่" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("ใหม่");
  });
});
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — the three new branch-management tests pass alongside the existing ones.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/branches.ts apps/api/src/routes/branches.test.ts
git commit -m "feat(api): add branch create and update routes"
```

---

## Task 12: Web — API client extension + auth Pinia store — TDD

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/auth.ts`, `apps/web/src/stores/auth.ts`
- Test: `apps/web/src/stores/auth.test.ts`

- [ ] **Step 1: Extend the API client — `apps/web/src/api/client.ts`**

Replace the contents of `apps/web/src/api/client.ts` with:
```typescript
export interface ApiError {
  code: string;
  message: string;
}

async function parse<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    const err = new Error(body?.message ?? `API ${path} failed with ${res.status}`);
    (err as Error & { code?: string; status: number }).status = res.status;
    (err as Error & { code?: string }).code = body?.code;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await fetch(path, { credentials: "include" }), path);
}

export async function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res, path);
}
```

- [ ] **Step 2: Create the auth API module — `apps/web/src/api/auth.ts`**

```typescript
import { apiGet, apiSend } from "./client";

export interface CurrentUser {
  id: number;
  username: string;
  name: string;
  roleKey: string;
  branchId: number | null;
  isBranchScoped: boolean;
  discountMaxPercent: number | null;
  permissions: string[];
  mustChangePassword: boolean;
}

export interface LoginResult {
  id: number;
  username: string;
  name: string;
  mustChangePassword: boolean;
}

export function login(username: string, password: string): Promise<LoginResult> {
  return apiSend<LoginResult>("POST", "/api/auth/login", { username, password });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("POST", "/api/auth/logout");
}

export function fetchMe(): Promise<CurrentUser> {
  return apiGet<CurrentUser>("/api/auth/me");
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("POST", "/api/auth/change-password", {
    currentPassword,
    newPassword,
  });
}
```

- [ ] **Step 3: Write the failing test — `apps/web/src/stores/auth.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "./auth";

function stubFetch(impl: (url: string, init?: RequestInit) => unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = impl(url, init);
      return { ok: true, json: async () => body };
    }),
  );
}

describe("auth store", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.restoreAllMocks());

  it("loads the current user and exposes permissions", async () => {
    stubFetch(() => ({
      id: 1,
      username: "alice",
      name: "Alice",
      roleKey: "admin",
      branchId: null,
      isBranchScoped: false,
      discountMaxPercent: null,
      permissions: ["users.view"],
      mustChangePassword: false,
    }));
    const store = useAuthStore();
    await store.loadMe();

    expect(store.user?.username).toBe("alice");
    expect(store.hasPermission("users.view")).toBe(true);
    expect(store.hasPermission("users.manage")).toBe(false);
  });

  it("clears the user on logout", async () => {
    stubFetch(() => ({ ok: true }));
    const store = useAuthStore();
    store.user = {
      id: 1, username: "a", name: "A", roleKey: "admin", branchId: null,
      isBranchScoped: false, discountMaxPercent: null, permissions: [], mustChangePassword: false,
    };
    await store.logout();
    expect(store.user).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test --workspace apps/web`
Expected: FAIL — cannot resolve `./auth`.

- [ ] **Step 5: Create the auth store — `apps/web/src/stores/auth.ts`**

```typescript
import { defineStore } from "pinia";
import { ref } from "vue";
import * as authApi from "../api/auth";
import type { CurrentUser } from "../api/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<CurrentUser | null>(null);
  const ready = ref(false);

  async function loadMe(): Promise<void> {
    try {
      user.value = await authApi.fetchMe();
    } catch {
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(username: string, password: string): Promise<void> {
    await authApi.login(username, password);
    await loadMe();
  }

  async function logout(): Promise<void> {
    await authApi.logout();
    user.value = null;
  }

  function hasPermission(key: string): boolean {
    return user.value?.permissions.includes(key) ?? false;
  }

  return { user, ready, loadMe, login, logout, hasPermission };
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --workspace apps/web`
Expected: PASS — the two auth-store tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add API client send helper and auth store"
```

---

## Task 13: Web — login, forced password change, router guards, app shell

**Files:**
- Create: `apps/web/src/views/LoginView.vue`, `apps/web/src/views/ChangePasswordView.vue`
- Modify: `apps/web/src/router/index.ts`, `apps/web/src/main.ts`, `apps/web/src/App.vue`, `apps/web/src/i18n/th.ts`, `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Add i18n keys to `apps/web/src/i18n/th.ts` and `en.ts`**

Add these keys to the default-exported object in `th.ts`:
```typescript
  login: "เข้าสู่ระบบ",
  logout: "ออกจากระบบ",
  username: "ชื่อผู้ใช้",
  password: "รหัสผ่าน",
  currentPassword: "รหัสผ่านปัจจุบัน",
  newPassword: "รหัสผ่านใหม่",
  changePassword: "เปลี่ยนรหัสผ่าน",
  users: "ผู้ใช้",
  roles: "บทบาทและสิทธิ์",
  save: "บันทึก",
  cancel: "ยกเลิก",
```
Add the same keys to `en.ts` with English values:
```typescript
  login: "Log in",
  logout: "Log out",
  username: "Username",
  password: "Password",
  currentPassword: "Current password",
  newPassword: "New password",
  changePassword: "Change password",
  users: "Users",
  roles: "Roles & permissions",
  save: "Save",
  cancel: "Cancel",
```

- [ ] **Step 2: Create `apps/web/src/views/LoginView.vue`**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const busy = ref(false);

async function submit(): Promise<void> {
  error.value = null;
  busy.value = true;
  try {
    await auth.login(username.value, password.value);
    router.replace(auth.user?.mustChangePassword ? "/change-password" : "/");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="login">
    <h2>{{ t("login") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("username") }}<input v-model="username" autocomplete="username" /></label>
      <label>{{ t("password") }}<input v-model="password" type="password" autocomplete="current-password" /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="busy">{{ t("login") }}</button>
    </form>
  </section>
</template>
```

- [ ] **Step 3: Create `apps/web/src/views/ChangePasswordView.vue`**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { changePassword } from "../api/auth";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const currentPassword = ref("");
const newPassword = ref("");
const error = ref<string | null>(null);
const busy = ref(false);

async function submit(): Promise<void> {
  error.value = null;
  busy.value = true;
  try {
    await changePassword(currentPassword.value, newPassword.value);
    await auth.loadMe();
    router.replace("/");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="change-password">
    <h2>{{ t("changePassword") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("currentPassword") }}<input v-model="currentPassword" type="password" /></label>
      <label>{{ t("newPassword") }}<input v-model="newPassword" type="password" minlength="8" /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="busy">{{ t("save") }}</button>
    </form>
  </section>
</template>
```

- [ ] **Step 4: Rewrite the router with guards — `apps/web/src/router/index.ts`**

```typescript
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LoginView from "../views/LoginView.vue";
import ChangePasswordView from "../views/ChangePasswordView.vue";
import BranchListView from "../views/BranchListView.vue";

const routes: RouteRecordRaw[] = [
  { path: "/login", name: "login", component: LoginView, meta: { public: true } },
  { path: "/change-password", name: "change-password", component: ChangePasswordView },
  { path: "/", redirect: "/branches" },
  { path: "/branches", name: "branches", component: BranchListView, meta: { permission: "branches.view" } },
  {
    path: "/branches/new",
    name: "branch-new",
    component: () => import("../views/BranchFormView.vue"),
    meta: { permission: "branches.manage" },
  },
  {
    path: "/branches/:id/edit",
    name: "branch-edit",
    component: () => import("../views/BranchFormView.vue"),
    meta: { permission: "branches.manage" },
  },
  {
    path: "/users",
    name: "users",
    component: () => import("../views/UserListView.vue"),
    meta: { permission: "users.view" },
  },
  {
    path: "/users/new",
    name: "user-new",
    component: () => import("../views/UserFormView.vue"),
    meta: { permission: "users.manage" },
  },
  {
    path: "/users/:id/edit",
    name: "user-edit",
    component: () => import("../views/UserFormView.vue"),
    meta: { permission: "users.manage" },
  },
  {
    path: "/roles",
    name: "roles",
    component: () => import("../views/RoleListView.vue"),
    meta: { permission: "roles.view" },
  },
  {
    path: "/roles/:id",
    name: "role-permissions",
    component: () => import("../views/RolePermissionsView.vue"),
    meta: { permission: "roles.view" },
  },
];

export const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.loadMe();

  if (to.meta.public) return true;
  if (!auth.user) return { name: "login" };
  if (auth.user.mustChangePassword && to.name !== "change-password") {
    return { name: "change-password" };
  }
  const permission = to.meta.permission as string | undefined;
  if (permission && !auth.hasPermission(permission)) return { path: "/" };
  return true;
});
```

- [ ] **Step 5: Update `apps/web/src/App.vue` into an app shell**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "./stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const signedIn = computed(() => auth.user !== null);

async function doLogout(): Promise<void> {
  await auth.logout();
  router.replace("/login");
}
</script>

<template>
  <header>
    <h1>{{ t("appName") }}</h1>
    <nav v-if="signedIn">
      <RouterLink v-if="auth.hasPermission('branches.view')" to="/branches">{{ t("branches") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('users.view')" to="/users">{{ t("users") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('roles.view')" to="/roles">{{ t("roles") }}</RouterLink>
      <span>{{ auth.user?.name }}</span>
      <button type="button" @click="doLogout">{{ t("logout") }}</button>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>
```

- [ ] **Step 6: Confirm `apps/web/src/main.ts` installs Pinia before the router**

Open `apps/web/src/main.ts` and verify the chain is `createApp(App).use(createPinia()).use(router).use(i18n).mount("#app")`. The router guard calls `useAuthStore()`, which needs Pinia installed first. The Phase 1 `main.ts` already has this order — no change needed; just verify.

- [ ] **Step 7: Build the web app to type-check**

Run: `npm run build --workspace apps/web`
Expected: exits 0. (The lazily-imported `UserListView.vue`, `UserFormView.vue`, `RoleListView.vue`, `RolePermissionsView.vue`, and `BranchFormView.vue` do not exist yet — but `vue-tsc` does not resolve dynamic `import()` targets at build time, so the build still succeeds. Those views are created in Tasks 14–16.)

If the build fails for any other reason, fix it before continuing.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add login, forced password change, router guards, and app shell"
```

---

## Task 14: Web — role & permission management views

**Files:**
- Create: `apps/web/src/api/roles.ts`, `apps/web/src/views/RoleListView.vue`, `apps/web/src/views/RolePermissionsView.vue`

- [ ] **Step 1: Create the roles API module — `apps/web/src/api/roles.ts`**

```typescript
import { apiGet, apiSend } from "./client";

export interface Role {
  id: number;
  key: string;
  name: string;
  isBranchScoped: boolean;
  discountMaxPercent: number | null;
  permissionKeys: string[];
}

export interface Permission {
  id: number;
  key: string;
  description: string;
}

export function fetchRoles(): Promise<Role[]> {
  return apiGet<Role[]>("/api/roles");
}

export function fetchPermissions(): Promise<Permission[]> {
  return apiGet<Permission[]>("/api/permissions");
}

export function updateRolePermissions(roleId: number, permissionKeys: string[]): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("PUT", `/api/roles/${roleId}/permissions`, { permissionKeys });
}
```

- [ ] **Step 2: Create `apps/web/src/views/RoleListView.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchRoles, type Role } from "../api/roles";

const { t } = useI18n();
const roles = ref<Role[]>([]);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    roles.value = await fetchRoles();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <section>
    <h2>{{ t("roles") }}</h2>
    <p v-if="error" class="error">{{ error }}</p>
    <ul v-else>
      <li v-for="r in roles" :key="r.id">
        <RouterLink :to="`/roles/${r.id}`">{{ r.name }}</RouterLink>
        — {{ r.permissionKeys.length }} สิทธิ์
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 3: Create `apps/web/src/views/RolePermissionsView.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchRoles, fetchPermissions, updateRolePermissions, type Permission } from "../api/roles";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const roleId = Number(route.params.id);
const roleName = ref("");
const permissions = ref<Permission[]>([]);
const selected = ref<Set<string>>(new Set());
const error = ref<string | null>(null);

onMounted(async () => {
  permissions.value = await fetchPermissions();
  const role = (await fetchRoles()).find((r) => r.id === roleId);
  if (role) {
    roleName.value = role.name;
    selected.value = new Set(role.permissionKeys);
  }
});

function toggle(key: string): void {
  if (selected.value.has(key)) selected.value.delete(key);
  else selected.value.add(key);
  selected.value = new Set(selected.value);
}

async function save(): Promise<void> {
  error.value = null;
  try {
    await updateRolePermissions(roleId, [...selected.value]);
    router.replace("/roles");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <section>
    <h2>{{ t("roles") }} — {{ roleName }}</h2>
    <ul>
      <li v-for="p in permissions" :key="p.key">
        <label>
          <input
            type="checkbox"
            :checked="selected.has(p.key)"
            :disabled="!auth.hasPermission('roles.manage')"
            @change="toggle(p.key)"
          />
          {{ p.description }} <code>({{ p.key }})</code>
        </label>
      </li>
    </ul>
    <p v-if="error" class="error">{{ error }}</p>
    <button v-if="auth.hasPermission('roles.manage')" type="button" @click="save">
      {{ t("save") }}
    </button>
    <RouterLink to="/roles">{{ t("cancel") }}</RouterLink>
  </section>
</template>
```

- [ ] **Step 4: Build the web app to type-check**

Run: `npm run build --workspace apps/web`
Expected: exits 0. The router lazy-imports `UserListView.vue`, `UserFormView.vue`, and `BranchFormView.vue`, which do not exist yet — `vue-tsc` does not resolve dynamic `import()` targets at build time, so the build still succeeds. Those views are created in Tasks 15–16.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add role and permission management views"
```

---

## Task 15: Web — user management views

**Files:**
- Create: `apps/web/src/api/users.ts`, `apps/web/src/views/UserListView.vue`, `apps/web/src/views/UserFormView.vue`

- [ ] **Step 1: Create the users API module — `apps/web/src/api/users.ts`**

```typescript
import { apiGet, apiSend } from "./client";

export interface User {
  id: number;
  username: string;
  name: string;
  roleId: number;
  branchId: number | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface NewUser {
  username: string;
  name: string;
  password: string;
  roleId: number;
  branchId: number | null;
}

export function fetchUsers(): Promise<User[]> {
  return apiGet<User[]>("/api/users");
}

export function createUser(input: NewUser): Promise<User> {
  return apiSend<User>("POST", "/api/users", input);
}

export function updateUser(id: number, patch: Partial<Omit<User, "id" | "username">>): Promise<User> {
  return apiSend<User>("PATCH", `/api/users/${id}`, patch);
}
```

- [ ] **Step 2: Create `apps/web/src/views/UserListView.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchUsers, type User } from "../api/users";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();
const users = ref<User[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    users.value = await fetchUsers();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <header>
      <h2>{{ t("users") }}</h2>
      <RouterLink v-if="auth.hasPermission('users.manage')" to="/users/new">+ {{ t("users") }}</RouterLink>
    </header>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
      <thead>
        <tr><th>{{ t("username") }}</th><th>{{ t("users") }}</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.username }}</td>
          <td>{{ u.name }}<span v-if="!u.isActive"> (ปิดใช้งาน)</span></td>
          <td>
            <RouterLink v-if="auth.hasPermission('users.manage')" :to="`/users/${u.id}/edit`">
              {{ t("save") }}
            </RouterLink>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
```

- [ ] **Step 3: Create `apps/web/src/views/UserFormView.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchUsers, createUser, updateUser } from "../api/users";
import { fetchRoles, type Role } from "../api/roles";
import { fetchBranches, type Branch } from "../api/branches";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const roles = ref<Role[]>([]);
const branches = ref<Branch[]>([]);
const error = ref<string | null>(null);

const form = ref({
  username: "",
  name: "",
  password: "",
  roleId: 0,
  branchId: null as number | null,
  isActive: true,
});

onMounted(async () => {
  roles.value = await fetchRoles();
  branches.value = await fetchBranches();
  if (roles.value[0]) form.value.roleId = roles.value[0].id;
  if (editingId.value !== null) {
    const existing = (await fetchUsers()).find((u) => u.id === editingId.value);
    if (existing) {
      form.value.username = existing.username;
      form.value.name = existing.name;
      form.value.roleId = existing.roleId;
      form.value.branchId = existing.branchId;
      form.value.isActive = existing.isActive;
    }
  }
});

async function submit(): Promise<void> {
  error.value = null;
  try {
    if (editingId.value !== null) {
      await updateUser(editingId.value, {
        name: form.value.name,
        roleId: form.value.roleId,
        branchId: form.value.branchId,
        isActive: form.value.isActive,
      });
    } else {
      await createUser({
        username: form.value.username,
        name: form.value.name,
        password: form.value.password,
        roleId: form.value.roleId,
        branchId: form.value.branchId,
      });
    }
    router.replace("/users");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <section>
    <h2>{{ t("users") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("username") }}
        <input v-model="form.username" :disabled="editingId !== null" />
      </label>
      <label>ชื่อ<input v-model="form.name" /></label>
      <label v-if="editingId === null">{{ t("password") }}
        <input v-model="form.password" type="password" minlength="8" />
      </label>
      <label>{{ t("roles") }}
        <select v-model.number="form.roleId">
          <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <label>{{ t("branches") }}
        <select v-model.number="form.branchId">
          <option :value="null">—</option>
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </label>
      <label v-if="editingId !== null">
        <input v-model="form.isActive" type="checkbox" /> ใช้งานอยู่
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">{{ t("save") }}</button>
      <RouterLink to="/users">{{ t("cancel") }}</RouterLink>
    </form>
  </section>
</template>
```

- [ ] **Step 4: Build the web app to type-check**

Run: `npm run build --workspace apps/web`
Expected: exits 0. `UserFormView.vue` imports `fetchRoles`/`Role` from `../api/roles` (created in Task 14) and `fetchBranches`/`Branch` from `../api/branches` (exists since Phase 1) — both resolve. With `UserListView.vue` and `UserFormView.vue` now present, only `BranchFormView.vue` (Task 16) remains a not-yet-existing lazy router import, which does not break the build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add user management list and form views"
```

---

## Task 16: Web — branch management views

**Files:**
- Modify: `apps/web/src/api/branches.ts`, `apps/web/src/views/BranchListView.vue`
- Create: `apps/web/src/views/BranchFormView.vue`

- [ ] **Step 1: Extend `apps/web/src/api/branches.ts`**

Replace the contents with:
```typescript
import { apiGet, apiSend } from "./client";

export interface Branch {
  id: number;
  name: string;
  code: string;
  isWarehouse: boolean;
}

export interface BranchInput {
  name: string;
  code: string;
  isWarehouse: boolean;
}

export function fetchBranches(): Promise<Branch[]> {
  return apiGet<Branch[]>("/api/branches");
}

export function createBranch(input: BranchInput): Promise<Branch> {
  return apiSend<Branch>("POST", "/api/branches", input);
}

export function updateBranch(id: number, patch: Partial<BranchInput>): Promise<Branch> {
  return apiSend<Branch>("PATCH", `/api/branches/${id}`, patch);
}
```

- [ ] **Step 2: Update `apps/web/src/views/BranchListView.vue` to add a manage link**

Replace the contents with:
```vue
<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useBranchStore } from "../stores/branch";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const store = useBranchStore();
const auth = useAuthStore();

onMounted(() => store.load());
</script>

<template>
  <section>
    <header>
      <h2>{{ t("branches") }}</h2>
      <RouterLink v-if="auth.hasPermission('branches.manage')" to="/branches/new">
        + {{ t("branches") }}
      </RouterLink>
    </header>
    <p v-if="store.loading">…</p>
    <p v-else-if="store.error" class="error">{{ store.error }}</p>
    <ul v-else>
      <li v-for="b in store.branches" :key="b.id">
        {{ b.name }} ({{ b.code }})
        <RouterLink v-if="auth.hasPermission('branches.manage')" :to="`/branches/${b.id}/edit`">
          {{ t("save") }}
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 3: Create `apps/web/src/views/BranchFormView.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchBranches, createBranch, updateBranch } from "../api/branches";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const error = ref<string | null>(null);
const form = ref({ name: "", code: "", isWarehouse: false });

onMounted(async () => {
  if (editingId.value !== null) {
    const existing = (await fetchBranches()).find((b) => b.id === editingId.value);
    if (existing) {
      form.value = { name: existing.name, code: existing.code, isWarehouse: existing.isWarehouse };
    }
  }
});

async function submit(): Promise<void> {
  error.value = null;
  try {
    if (editingId.value !== null) {
      await updateBranch(editingId.value, form.value);
    } else {
      await createBranch(form.value);
    }
    router.replace("/branches");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <section>
    <h2>{{ t("branches") }}</h2>
    <form @submit.prevent="submit">
      <label>ชื่อ<input v-model="form.name" /></label>
      <label>รหัส<input v-model="form.code" /></label>
      <label><input v-model="form.isWarehouse" type="checkbox" /> เป็นคลังสินค้า</label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">{{ t("save") }}</button>
      <RouterLink to="/branches">{{ t("cancel") }}</RouterLink>
    </form>
  </section>
</template>
```

- [ ] **Step 4: Run the web tests and build**

Run: `npm test --workspace apps/web`
Expected: PASS — the existing branch-store and auth-store tests still pass.

Run: `npm run build --workspace apps/web`
Expected: exits 0 — the whole web app type-checks and builds.

- [ ] **Step 5: Manual end-to-end check**

Run `npm run db:up`, `npm run dev:api`, and `npm run dev:web` in separate terminals. Ensure the dev DB has been migrated and seeded (Tasks 1 & 3). Open the Vite URL.
Expected: you are redirected to `/login`. Log in as the seeded admin (`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` from `.env`). Because the admin has `mustChangePassword`, you are sent to `/change-password`; change it, then you land on the branches page. The nav shows Users and Roles. Create a branch, a user, and edit a role's permissions.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add branch management views"
```

---

## Self-Review Notes

- **Spec coverage (§4.3, §8.4):** argon2 hashing ✓ (Task 2); session cookie `httpOnly`/`secure`/`sameSite` ✓ (Task 5, `COOKIE_OPTS`); force password change on first login ✓ (Tasks 3, 5, 7 — seeded `mustChangePassword: true`, enforced by `requirePermission` + frontend guard); per-endpoint permission middleware ✓ (Task 5 `requirePermission`, applied in Tasks 6, 9, 10, 11); branch-scoping enforced server-side ✓ (Task 8 `branchFilter`, applied to the users list in Task 9); `discountMaxPercent` stored on roles ✓ (Tasks 1, 3 — its *enforcement* belongs to Phase 5 POS, where discounts exist); roles/permissions/role_permissions in the DB ✓ (Task 1); rate limiting on login ✓ (Task 5); 2-sided validation ✓ (Fastify JSON Schema on every write route + frontend `minlength`/required fields); seed of roles/permissions/admin ✓ (Task 3).
- **Out of Phase 2 scope:** the `sessions` table is created and used here; catalog/stock/customers/sales tables belong to later phases. `app_settings` seeding (mentioned in spec §10) is deferred to Phase 9 (Settings).
- **Type consistency:** `AuthUser` (Task 5 `fastify.d.ts`) is consumed by `branchFilter` (Task 8) and the auth plugin (Task 5). The web `CurrentUser` (Task 12) mirrors the API `/api/auth/me` payload (the `AuthUser` shape). `Role`/`fetchRoles` are defined in `apps/web/src/api/roles.ts` (Task 14) and consumed by `UserFormView.vue` (Task 15) — roles management is sequenced before user management precisely so that import resolves. `Branch`/`fetchBranches` from `apps/web/src/api/branches.ts` (Phase 1, extended in Task 16) are also consumed by `UserFormView.vue` (Task 15).
- **`buildApp` stays synchronous:** the Phase 1 signature is unchanged. Tasks 5+ register the auth plugin before the route plugins; Fastify runs registered plugins in order, and `authPlugin` is `fastify-plugin`-wrapped, so its decorators are present when the route plugins execute. Every API test uses `buildApp()` (no `await`).
- **No placeholders:** every step contains full file content or an exact command with expected output.

## Next Phase

Phase 3 (Catalog & Stock) gets its own plan under `docs/superpowers/plans/` once Phase 2 is complete and reviewed.
