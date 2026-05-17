# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project skeleton — monorepo, PostgreSQL, Fastify API, and Vue web app, wired together end-to-end with one real feature (list branches) proving the full stack works.

**Architecture:** An npm-workspaces monorepo with `apps/api` (Fastify + TypeScript + Prisma) and `apps/web` (Vue 3 + Vite + TypeScript). PostgreSQL runs in Docker via `docker-compose.yml`. In production, nginx reverse-proxies the built web app and the API. The existing demo is moved to `legacy-demo/` for reference only.

**Tech Stack:** Node 20, TypeScript 5, Fastify 4, Prisma 5, PostgreSQL 16, Vue 3.4, Vite 5, vue-router 4, Pinia 2, vue-i18n 9, Vitest, Docker Compose, nginx.

**Reference spec:** `docs/superpowers/specs/2026-05-17-furniture-pos-production-design.md`

---

## File Structure

After this phase the repo looks like:

```
furniture-pos/
  legacy-demo/              old demo (app.js, data.js, index.html, styles.css) — reference only
  apps/
    api/
      src/
        app.ts              buildApp() — Fastify instance + routes
        server.ts           process entrypoint (listen)
        prisma.ts           shared PrismaClient singleton
        routes/
          branches.ts       GET /api/branches
        app.test.ts         health-endpoint test
        routes/
          branches.test.ts  branches integration test
      prisma/
        schema.prisma       datasource + Branch model
      vitest.config.ts
      vitest.setup.ts       applies migrations to the test database
      tsconfig.json
      package.json
    web/
      src/
        main.ts             app bootstrap (router, pinia, i18n)
        App.vue
        router/index.ts
        stores/branch.ts     Pinia store for branches
        api/client.ts        fetch wrapper
        api/branches.ts      branches API calls
        views/BranchListView.vue
        i18n/index.ts
        i18n/th.ts, i18n/en.ts
      src/stores/branch.test.ts
      vite.config.ts
      vitest.config.ts
      tsconfig.json
      package.json
  nginx/
    nginx.conf              production reverse-proxy config
  docker-compose.yml        dev: postgres only
  docker-compose.prod.yml   prod: postgres + api + nginx
  package.json              npm workspaces root
  .env.example
  .gitignore
  README.md
```

---

## Task 1: Initialize git, monorepo skeleton, and move the demo aside

**Files:**
- Create: `.gitignore`, `package.json` (root), `.env.example`, `README.md`
- Move: `app.js`, `data.js`, `index.html`, `styles.css` → `legacy-demo/`

- [ ] **Step 1: Initialize git**

Run: `git init`
Expected: `Initialized empty Git repository in .../furniture-pos/.git/`

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
.env
*.log
.DS_Store
apps/api/prisma/*.db
```

- [ ] **Step 3: Move the demo into `legacy-demo/`**

Run:
```bash
mkdir -p legacy-demo
mv app.js data.js index.html styles.css legacy-demo/
```
Expected: `ls legacy-demo` shows the four files; repo root no longer has them.

- [ ] **Step 4: Create the root workspace `package.json`**

```json
{
  "name": "furniture-pos",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev:api": "npm run dev --workspace apps/api",
    "dev:web": "npm run dev --workspace apps/web",
    "test": "npm run test --workspaces --if-present",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down"
  },
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 5: Create `.env.example`**

```
# PostgreSQL (dev — used by docker-compose.yml)
POSTGRES_USER=furniture
POSTGRES_PASSWORD=change_me_in_real_env
POSTGRES_DB=furniture_pos

# API
API_PORT=3000
DATABASE_URL=postgresql://furniture:change_me_in_real_env@localhost:5544/furniture_pos
DATABASE_URL_TEST=postgresql://furniture:change_me_in_real_env@localhost:5544/furniture_pos_test
```

- [ ] **Step 6: Create `README.md`**

```markdown
# Furniture House POS

Production rebuild of the multi-branch furniture POS.
See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for plans.
The original demo is preserved in `legacy-demo/` for reference only.

## Local development

1. `cp .env.example .env` and edit values.
2. `npm install`
3. `npm run db:up` — start PostgreSQL in Docker.
4. `npm run dev:api` and `npm run dev:web` in separate terminals.
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo, move demo to legacy-demo/"
```

---

## Task 2: PostgreSQL via Docker Compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5544:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 2: Start the database**

Run: `cp .env.example .env && npm run db:up`
Expected: `docker compose ps` shows the `postgres` service as `running`.

- [ ] **Step 3: Create the test database**

Run:
```bash
docker compose exec postgres psql -U furniture -d furniture_pos -c "CREATE DATABASE furniture_pos_test;"
```
Expected: `CREATE DATABASE`

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add PostgreSQL docker-compose for development"
```

---

## Task 3: API skeleton — Fastify + TypeScript + health endpoint (TDD)

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@furniture-pos/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "^4.28.1"
  },
  "devDependencies": {
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1",
    "@types/node": "^20.16.5"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/api/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: completes without error; `apps/api/node_modules` exists.

- [ ] **Step 5: Write the failing test — `apps/api/src/app.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { buildApp } from "./app";

describe("GET /health", () => {
  it("returns status ok", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test --workspace apps/api`
Expected: FAIL — cannot resolve `./app` (module does not exist yet).

- [ ] **Step 7: Create `apps/api/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test --workspace apps/api`
Expected: PASS — 1 test passed.

- [ ] **Step 9: Create `apps/api/src/server.ts`**

```typescript
import { buildApp } from "./app";

const app = buildApp();
const port = Number(process.env.API_PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .then((address) => console.log(`API listening on ${address}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 10: Commit**

```bash
git add apps/api package-lock.json
git commit -m "feat(api): Fastify skeleton with health endpoint"
```

---

## Task 4: Prisma setup, Branch model, and first migration

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/src/prisma.ts`
- Modify: `apps/api/package.json` (add Prisma deps + scripts)

- [ ] **Step 1: Add Prisma dependencies and scripts to `apps/api/package.json`**

Add to `dependencies`: `"@prisma/client": "^5.20.0"`.
Add to `devDependencies`: `"prisma": "^5.20.0"`.
Add to `scripts`:
```json
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev"
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes without error.

- [ ] **Step 3: Create `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Branch {
  id          Int      @id @default(autoincrement())
  name        String
  code        String   @unique
  isWarehouse Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@map("branches")
}
```

- [ ] **Step 4: Create the first migration**

Run: `cd apps/api && DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" npx prisma migrate dev --name init_branches && cd ../..`
Expected: migration created under `apps/api/prisma/migrations/`; output ends with `Your database is now in sync with your schema`.

- [ ] **Step 5: Create the Prisma client singleton — `apps/api/src/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma apps/api/src/prisma.ts apps/api/package.json package-lock.json
git commit -m "feat(api): add Prisma with Branch model and initial migration"
```

---

## Task 5: GET /api/branches endpoint backed by the database (TDD)

**Files:**
- Create: `apps/api/src/routes/branches.ts`, `apps/api/vitest.setup.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/vitest.config.ts`
- Test: `apps/api/src/routes/branches.test.ts`

- [ ] **Step 1: Create `apps/api/vitest.setup.ts` (applies migrations to the test DB before tests)**

```typescript
import { execSync } from "node:child_process";
import { beforeAll } from "vitest";

beforeAll(() => {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) throw new Error("DATABASE_URL_TEST is not set");
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  });
});
```

- [ ] **Step 2: Update `apps/api/vitest.config.ts` to load env and the setup file**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
    },
  },
});
```

- [ ] **Step 3: Write the failing test — `apps/api/src/routes/branches.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app";
import { prisma } from "../prisma";

describe("GET /api/branches", () => {
  beforeEach(async () => {
    await prisma.branch.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns all branches ordered by id", async () => {
    await prisma.branch.create({ data: { name: "สาขาสยาม", code: "BKK01" } });
    await prisma.branch.create({ data: { name: "คลังกลาง", code: "WH01", isWarehouse: true } });

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/branches" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].code).toBe("BKK01");
    expect(body[1].isWarehouse).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: FAIL — route `/api/branches` returns 404.

- [ ] **Step 5: Create `apps/api/src/routes/branches.ts`**

```typescript
import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma";

export async function branchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/branches", async () => {
    return prisma.branch.findMany({ orderBy: { id: "asc" } });
  });
}
```

- [ ] **Step 6: Register the route in `apps/api/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from "fastify";
import { branchRoutes } from "./routes/branches";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(branchRoutes);

  return app;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' .env | cut -d= -f2-)" npm test --workspace apps/api`
Expected: PASS — 2 tests passed (health + branches).

- [ ] **Step 8: Commit**

```bash
git add apps/api
git commit -m "feat(api): add GET /api/branches backed by PostgreSQL"
```

---

## Task 6: Web skeleton — Vue 3 + Vite + TypeScript + router/Pinia/i18n

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/index.html`, `apps/web/src/main.ts`, `apps/web/src/App.vue`, `apps/web/src/router/index.ts`, `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/th.ts`, `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@furniture-pos/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "vue": "^3.5.8",
    "vue-router": "^4.4.5",
    "pinia": "^2.2.2",
    "vue-i18n": "^9.14.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.4",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^15.7.4",
    "typescript": "^5.6.2",
    "vite": "^5.4.7",
    "vitest": "^2.1.1",
    "vue-tsc": "^2.1.6"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM"],
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

- [ ] **Step 4: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create `apps/web/index.html`**

```html
<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Furniture House POS</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create the i18n dictionaries**

`apps/web/src/i18n/th.ts`:
```typescript
export default {
  appName: "Furniture House POS",
  branches: "สาขา",
};
```

`apps/web/src/i18n/en.ts`:
```typescript
export default {
  appName: "Furniture House POS",
  branches: "Branches",
};
```

`apps/web/src/i18n/index.ts`:
```typescript
import { createI18n } from "vue-i18n";
import th from "./th";
import en from "./en";

export const i18n = createI18n({
  legacy: false,
  locale: "th",
  fallbackLocale: "en",
  messages: { th, en },
});
```

- [ ] **Step 7: Create the router — `apps/web/src/router/index.ts`**

```typescript
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import BranchListView from "../views/BranchListView.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/branches" },
  { path: "/branches", name: "branches", component: BranchListView },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
```

- [ ] **Step 8: Create `apps/web/src/App.vue`**

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>

<template>
  <header>
    <h1>{{ t("appName") }}</h1>
  </header>
  <main>
    <RouterView />
  </main>
</template>
```

- [ ] **Step 9: Create `apps/web/src/main.ts`**

```typescript
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { i18n } from "./i18n";

createApp(App).use(createPinia()).use(router).use(i18n).mount("#app");
```

- [ ] **Step 10: Install dependencies**

Run: `npm install`
Expected: completes without error.

> Note: `BranchListView.vue` is created in Task 7. The web app will not build until then; that is expected.

- [ ] **Step 11: Commit**

```bash
git add apps/web package-lock.json
git commit -m "feat(web): Vue 3 + Vite skeleton with router, Pinia, and i18n"
```

---

## Task 7: Branch list — Pinia store + view fetching from the API (TDD)

**Files:**
- Create: `apps/web/src/api/client.ts`, `apps/web/src/api/branches.ts`, `apps/web/src/stores/branch.ts`, `apps/web/src/views/BranchListView.vue`
- Test: `apps/web/src/stores/branch.test.ts`

- [ ] **Step 1: Create the fetch wrapper — `apps/web/src/api/client.ts`**

```typescript
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`API ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Create the branches API module — `apps/web/src/api/branches.ts`**

```typescript
import { apiGet } from "./client";

export interface Branch {
  id: number;
  name: string;
  code: string;
  isWarehouse: boolean;
}

export function fetchBranches(): Promise<Branch[]> {
  return apiGet<Branch[]>("/api/branches");
}
```

- [ ] **Step 3: Write the failing test — `apps/web/src/stores/branch.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useBranchStore } from "./branch";

describe("branch store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads branches from the API into state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, name: "สาขาสยาม", code: "BKK01", isWarehouse: false },
        ],
      }),
    );

    const store = useBranchStore();
    await store.load();

    expect(store.branches).toHaveLength(1);
    expect(store.branches[0].code).toBe("BKK01");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test --workspace apps/web`
Expected: FAIL — cannot resolve `./branch` (store does not exist yet).

- [ ] **Step 5: Create the Pinia store — `apps/web/src/stores/branch.ts`**

```typescript
import { defineStore } from "pinia";
import { ref } from "vue";
import { fetchBranches, type Branch } from "../api/branches";

export const useBranchStore = defineStore("branch", () => {
  const branches = ref<Branch[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      branches.value = await fetchBranches();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "unknown error";
    } finally {
      loading.value = false;
    }
  }

  return { branches, loading, error, load };
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --workspace apps/web`
Expected: PASS — 1 test passed.

- [ ] **Step 7: Create the view — `apps/web/src/views/BranchListView.vue`**

```vue
<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useBranchStore } from "../stores/branch";

const { t } = useI18n();
const store = useBranchStore();

onMounted(() => store.load());
</script>

<template>
  <section>
    <h2>{{ t("branches") }}</h2>
    <p v-if="store.loading">…</p>
    <p v-else-if="store.error">{{ store.error }}</p>
    <ul v-else>
      <li v-for="b in store.branches" :key="b.id">
        {{ b.name }} ({{ b.code }})
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 8: Manual end-to-end check**

Run `npm run db:up`, `npm run dev:api`, and `npm run dev:web` (separate terminals). Open the Vite URL.
Expected: the page shows "สาขา" with the branches created by the Task 5 test, or an empty list if the test DB was used. Insert a row to confirm:
```bash
docker compose exec postgres psql -U furniture -d furniture_pos -c \
  "INSERT INTO branches (name, code, \"isWarehouse\") VALUES ('สาขาสยาม', 'BKK01', false);"
```
Reload — the branch appears.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): branch list view fetching from the API"
```

---

## Task 8: Production deployment config — nginx + prod compose

**Files:**
- Create: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `nginx/nginx.conf`, `docker-compose.prod.yml`, `docs/DEPLOY.md`

- [ ] **Step 1: Create `apps/api/Dockerfile`**

```dockerfile
FROM node:20-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace apps/api
COPY apps/api apps/api
RUN npm run prisma:generate --workspace apps/api && npm run build --workspace apps/api

FROM node:20-slim
WORKDIR /repo/apps/api
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
CMD ["node", "dist/server.js"]
```

- [ ] **Step 2: Create `apps/web/Dockerfile`**

```dockerfile
FROM node:20-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace apps/web
COPY apps/web apps/web
RUN npm run build --workspace apps/web

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
```

- [ ] **Step 3: Create `nginx/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Create `docker-compose.prod.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      API_PORT: 3000
    depends_on:
      - postgres
    command: sh -c "npx prisma migrate deploy && node dist/server.js"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  pgdata:
```

- [ ] **Step 5: Create `docs/DEPLOY.md`**

```markdown
# Deploying to the VPS

Prerequisites: Docker + Docker Compose on the VPS.

1. Clone the repo onto the VPS.
2. `cp .env.example .env` and set strong values. For production `DATABASE_URL`
   the host is the compose service name: `postgresql://USER:PASS@postgres:5432/DB`.
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. The web app is served on port 80. Put a TLS reverse proxy
   (e.g. Caddy, or nginx with certbot) in front for HTTPS — see Phase 10.

## Daily backup (cron on the VPS)

Add to crontab — dumps the database every day at 02:00 and keeps 14 days:

    0 2 * * * docker compose -f /path/docker-compose.prod.yml exec -T postgres \
      pg_dump -U furniture furniture_pos | gzip > /backups/pos-$(date +\%F).sql.gz

Copy `/backups` off the VPS regularly.
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/Dockerfile apps/web/Dockerfile nginx docker-compose.prod.yml docs/DEPLOY.md
git commit -m "chore: add production Docker, nginx, and deploy docs"
```

---

## Self-Review Notes

- **Spec coverage (Phase 1 scope only):** monorepo skeleton ✓ (Task 1), PostgreSQL ✓ (Task 2),
  Fastify API skeleton ✓ (Task 3), Prisma schema + migrations ✓ (Task 4), end-to-end vertical
  slice ✓ (Tasks 5/7), Vue + Vite skeleton ✓ (Tasks 6/7), test setup for both apps ✓
  (Tasks 3/5/7), deploy-to-VPS steps ✓ (Task 8). Auth, RBAC, and all domain features are
  intentionally out of scope here — they belong to Phase 2 onward.
- **Type consistency:** `Branch` shape (`id`, `name`, `code`, `isWarehouse`) matches across the
  Prisma model (Task 4), the API response (Task 5), and the web `Branch` interface (Task 7).
  `buildApp()` signature is identical in Tasks 3 and 5. `useBranchStore` exposes
  `branches`/`loading`/`error`/`load`, all consumed by the view in Task 7.
- **No placeholders:** every step contains the full file content or an exact command with
  expected output.

## Next Phases

Each gets its own plan document under `docs/superpowers/plans/` once the prior phase is done:
Phase 2 Auth & RBAC · Phase 3 Catalog & Stock · Phase 4 Customers · Phase 5 POS & Sales ·
Phase 6 Receipts/Quotations/Outstanding · Phase 7 Delivery · Phase 8 Reports & Dashboard ·
Phase 9 Settings/Audit/Import-Export · Phase 10 Hardening & Go-live.
