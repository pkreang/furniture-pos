import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as vm from "node:vm";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../auth/password.js";

type LegacyBranch = { id: number; name: string; code: string };
type LegacyCategory = { id: string; name: string };
type LegacyProduct = {
  id: string;
  categoryId: string;
  name: string;
  sku: string;
  price: number;
  stock?: Record<string, number>;
  materialTypes?: string[];
};
type LegacyCustomer = {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  points?: number;
  totalSpent?: number;
};
type LegacyZone = { name: string; fee: number };
type LegacyChannel = { name: string; type: string };
type LegacyTeam = {
  id: number;
  name: string;
  branchId: number;
  driverIds: number[];
};
type LegacyDriver = { id: number; name: string; phone?: string };
type LegacyUser = {
  username: string;
  name: string;
  role: string;
  branchId: number | null;
};

interface LegacyAppData {
  branches: LegacyBranch[];
  categories: LegacyCategory[];
  products: LegacyProduct[];
  customers: LegacyCustomer[];
  deliveryZones: LegacyZone[];
  deliveryChannels: LegacyChannel[];
  deliveryTeams: LegacyTeam[];
  drivers: LegacyDriver[];
  users: LegacyUser[];
}

interface Counts {
  created: number;
  updated: number;
  skipped: number;
}

class DryRunRollback extends Error {
  constructor() {
    super("dry-run rollback");
    this.name = "DryRunRollback";
  }
}

function loadLegacyAppData(): LegacyAppData {
  const here = dirname(fileURLToPath(import.meta.url));
  const legacyPath = resolve(here, "../../../../legacy-demo/data.js");
  const source = readFileSync(legacyPath, "utf8");

  // The legacy file declares `const AppData = ...` at top level, which would be
  // script-scoped inside vm.runInContext. Wrap it in an IIFE that returns
  // AppData so we can capture it.
  const wrapped = `globalThis.__legacyAppData = (function () { ${source}\n; return AppData; })();`;

  const sandbox: Record<string, unknown> = {
    globalThis: {} as Record<string, unknown>,
    console: { log: () => undefined, warn: () => undefined, error: () => undefined },
    localStorage: { getItem: () => null, setItem: () => undefined },
    BroadcastChannel: class {
      addEventListener(): void {}
      postMessage(): void {}
      close(): void {}
    },
    document: { addEventListener: () => undefined },
    window: {},
  };
  // Self-reference so `globalThis` inside the sandbox is the sandbox itself.
  (sandbox.globalThis as Record<string, unknown>) = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: legacyPath });

  const data = (sandbox as { __legacyAppData?: LegacyAppData }).__legacyAppData;
  if (!data?.branches?.length) {
    throw new Error("Failed to load AppData from legacy-demo/data.js");
  }
  return data;
}

function fmt(label: string, counts: Counts): string {
  return `  ${label.padEnd(18)} created=${counts.created}  updated=${counts.updated}  skipped=${counts.skipped}`;
}

async function migrateBranches(
  tx: Prisma.TransactionClient,
  legacy: LegacyBranch[],
): Promise<{ counts: Counts; byLegacyId: Map<number, number> }> {
  const counts: Counts = { created: 0, updated: 0, skipped: 0 };
  const byLegacyId = new Map<number, number>();
  for (const b of legacy) {
    const existing = await tx.branch.findUnique({ where: { code: b.code } });
    const row = await tx.branch.upsert({
      where: { code: b.code },
      update: { name: b.name },
      create: { name: b.name, code: b.code, isWarehouse: false },
    });
    byLegacyId.set(b.id, row.id);
    existing ? counts.updated++ : counts.created++;
  }
  return { counts, byLegacyId };
}

async function migrateCategories(
  tx: Prisma.TransactionClient,
  legacy: LegacyCategory[],
): Promise<{ counts: Counts; byLegacyId: Map<string, number> }> {
  const counts: Counts = { created: 0, updated: 0, skipped: 0 };
  const byLegacyId = new Map<string, number>();
  for (const c of legacy) {
    const existing = await tx.category.findUnique({ where: { name: c.name } });
    const row = await tx.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name },
    });
    byLegacyId.set(c.id, row.id);
    existing ? counts.updated++ : counts.created++;
  }
  return { counts, byLegacyId };
}

async function migrateProductsAndStock(
  tx: Prisma.TransactionClient,
  products: LegacyProduct[],
  categoryIds: Map<string, number>,
  branchIds: Map<number, number>,
): Promise<{ productCounts: Counts; stockCounts: Counts }> {
  const productCounts: Counts = { created: 0, updated: 0, skipped: 0 };
  const stockCounts: Counts = { created: 0, updated: 0, skipped: 0 };

  for (const p of products) {
    const categoryId = categoryIds.get(p.categoryId);
    if (!categoryId) {
      console.warn(`  skip product ${p.sku}: unknown legacy categoryId "${p.categoryId}"`);
      productCounts.skipped++;
      continue;
    }
    const isSofa = p.categoryId === "sofa" || Array.isArray(p.materialTypes);

    const existing = await tx.product.findUnique({ where: { sku: p.sku } });
    const row = await tx.product.upsert({
      where: { sku: p.sku },
      update: { name: p.name, basePrice: p.price, isSofa, categoryId },
      create: { sku: p.sku, name: p.name, basePrice: p.price, isSofa, categoryId },
    });
    existing ? productCounts.updated++ : productCounts.created++;

    for (const [legacyBranchId, qty] of Object.entries(p.stock ?? {})) {
      const branchId = branchIds.get(Number(legacyBranchId));
      if (!branchId) {
        console.warn(`  skip stock for ${p.sku}: unknown legacy branchId ${legacyBranchId}`);
        stockCounts.skipped++;
        continue;
      }
      const existingLevel = await tx.stockLevel.findUnique({
        where: { productId_branchId: { productId: row.id, branchId } },
      });
      await tx.stockLevel.upsert({
        where: { productId_branchId: { productId: row.id, branchId } },
        update: { quantity: qty },
        create: { productId: row.id, branchId, quantity: qty },
      });
      existingLevel ? stockCounts.updated++ : stockCounts.created++;
    }
  }
  return { productCounts, stockCounts };
}

async function migrateCustomers(
  tx: Prisma.TransactionClient,
  legacy: LegacyCustomer[],
): Promise<Counts> {
  const counts: Counts = { created: 0, updated: 0, skipped: 0 };
  for (const c of legacy) {
    const existing = await tx.customer.findUnique({ where: { phone: c.phone } });
    const data = {
      name: c.name,
      email: c.email ?? null,
      addrLine1: c.address ?? null,
      pointsBalance: c.points ?? 0,
      lifetimeSpend: c.totalSpent ?? 0,
    };
    await tx.customer.upsert({
      where: { phone: c.phone },
      update: data,
      create: { phone: c.phone, ...data },
    });
    existing ? counts.updated++ : counts.created++;
  }
  return counts;
}

async function migrateDeliveryZones(
  tx: Prisma.TransactionClient,
  legacy: LegacyZone[],
): Promise<Counts> {
  const counts: Counts = { created: 0, updated: 0, skipped: 0 };
  for (const z of legacy) {
    const existing = await tx.deliveryZone.findUnique({ where: { name: z.name } });
    await tx.deliveryZone.upsert({
      where: { name: z.name },
      update: { fee: z.fee },
      create: { name: z.name, fee: z.fee },
    });
    existing ? counts.updated++ : counts.created++;
  }
  return counts;
}

async function migrateDeliveryChannels(
  tx: Prisma.TransactionClient,
  legacy: LegacyChannel[],
): Promise<Counts> {
  const counts: Counts = { created: 0, updated: 0, skipped: 0 };
  for (const c of legacy) {
    const type = c.type === "inhouse" ? "IN_HOUSE" : "COURIER";
    const existing = await tx.deliveryChannel.findUnique({ where: { name: c.name } });
    await tx.deliveryChannel.upsert({
      where: { name: c.name },
      update: { type },
      create: { name: c.name, type },
    });
    existing ? counts.updated++ : counts.created++;
  }
  return counts;
}

async function migrateDeliveryTeamsAndDrivers(
  tx: Prisma.TransactionClient,
  teams: LegacyTeam[],
  drivers: LegacyDriver[],
  branchIds: Map<number, number>,
): Promise<{ teamCounts: Counts; driverCounts: Counts }> {
  const teamCounts: Counts = { created: 0, updated: 0, skipped: 0 };
  const driverCounts: Counts = { created: 0, updated: 0, skipped: 0 };

  const teamIdByLegacy = new Map<number, number>();
  for (const t of teams) {
    const branchId = branchIds.get(t.branchId);
    if (!branchId) {
      console.warn(`  skip team "${t.name}": unknown legacy branchId ${t.branchId}`);
      teamCounts.skipped++;
      continue;
    }
    const existing = await tx.deliveryTeam.findFirst({ where: { name: t.name, branchId } });
    const row = existing
      ? await tx.deliveryTeam.update({ where: { id: existing.id }, data: { name: t.name } })
      : await tx.deliveryTeam.create({ data: { name: t.name, branchId } });
    teamIdByLegacy.set(t.id, row.id);
    existing ? teamCounts.updated++ : teamCounts.created++;
  }

  const teamIdByDriverLegacyId = new Map<number, number>();
  for (const t of teams) {
    const teamId = teamIdByLegacy.get(t.id);
    if (!teamId) continue;
    for (const driverId of t.driverIds) {
      teamIdByDriverLegacyId.set(driverId, teamId);
    }
  }

  for (const d of drivers) {
    const teamId = teamIdByDriverLegacyId.get(d.id);
    if (!teamId) {
      console.warn(`  skip driver "${d.name}": not assigned to any team in legacy data`);
      driverCounts.skipped++;
      continue;
    }
    const existing = await tx.driver.findFirst({ where: { name: d.name, teamId } });
    if (existing) {
      await tx.driver.update({ where: { id: existing.id }, data: { phone: d.phone ?? null } });
      driverCounts.updated++;
    } else {
      await tx.driver.create({ data: { name: d.name, phone: d.phone ?? null, teamId } });
      driverCounts.created++;
    }
  }

  return { teamCounts, driverCounts };
}

async function migrateUsers(
  tx: Prisma.TransactionClient,
  legacy: LegacyUser[],
  branchIds: Map<number, number>,
): Promise<Counts> {
  const counts: Counts = { created: 0, updated: 0, skipped: 0 };
  const roleKeyMap: Record<string, string> = { accountant: "account" };

  const passwordHash = await hashPassword("1234");

  for (const u of legacy) {
    const roleKey = roleKeyMap[u.role] ?? u.role;
    const role = await tx.role.findUnique({ where: { key: roleKey } });
    if (!role) {
      console.warn(`  skip user "${u.username}": role "${roleKey}" not found in seed`);
      counts.skipped++;
      continue;
    }
    const branchId = u.branchId == null ? null : (branchIds.get(u.branchId) ?? null);
    const existing = await tx.user.findUnique({ where: { username: u.username } });
    await tx.user.upsert({
      where: { username: u.username },
      update: { name: u.name, roleId: role.id, branchId },
      create: {
        username: u.username,
        name: u.name,
        roleId: role.id,
        branchId,
        passwordHash,
        mustChangePassword: true,
      },
    });
    existing ? counts.updated++ : counts.created++;
  }
  return counts;
}

async function run(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const withUsers = process.argv.includes("--with-users");

  console.log(`migrate-from-legacy ${dryRun ? "(dry-run)" : ""}${withUsers ? " --with-users" : ""}`);
  const data = loadLegacyAppData();
  console.log(`loaded ${data.branches.length} branches, ${data.products.length} products, ${data.customers.length} customers`);

  const prisma = new PrismaClient();
  const lines: string[] = [];

  try {
    try {
      await prisma.$transaction(
        async (tx) => {
          const { counts: branchCounts, byLegacyId: branchIds } = await migrateBranches(tx, data.branches);
          lines.push(fmt("branches", branchCounts));

          const { counts: categoryCounts, byLegacyId: categoryIds } = await migrateCategories(tx, data.categories);
          lines.push(fmt("categories", categoryCounts));

          const { productCounts, stockCounts } = await migrateProductsAndStock(tx, data.products, categoryIds, branchIds);
          lines.push(fmt("products", productCounts));
          lines.push(fmt("stock levels", stockCounts));

          lines.push(fmt("customers", await migrateCustomers(tx, data.customers)));
          lines.push(fmt("delivery zones", await migrateDeliveryZones(tx, data.deliveryZones)));
          lines.push(fmt("delivery channels", await migrateDeliveryChannels(tx, data.deliveryChannels)));

          const { teamCounts, driverCounts } = await migrateDeliveryTeamsAndDrivers(tx, data.deliveryTeams, data.drivers, branchIds);
          lines.push(fmt("delivery teams", teamCounts));
          lines.push(fmt("drivers", driverCounts));

          if (withUsers) {
            lines.push(fmt("users", await migrateUsers(tx, data.users, branchIds)));
          } else {
            lines.push("  users              skipped (pass --with-users to include)");
          }

          if (dryRun) throw new DryRunRollback();
        },
        { timeout: 60_000 },
      );
    } catch (e) {
      if (!(e instanceof DryRunRollback)) throw e;
    }

    console.log("");
    console.log(dryRun ? "dry-run summary (rolled back):" : "summary:");
    for (const line of lines) console.log(line);
    console.log("");
    console.log("done.");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
