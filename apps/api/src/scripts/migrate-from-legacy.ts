import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as vm from "node:vm";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../auth/password.js";
import { checkout, CheckoutError } from "../sales/checkout.js";

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

function makeRandom(seedValue: number): () => number {
  let s = seedValue;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function seedSampleSales(prisma: PrismaClient): Promise<number> {
  const cashier = await prisma.user.findFirst({
    where: {
      isActive: true,
      role: { permissions: { some: { permission: { key: "sales.create" } } } },
    },
    orderBy: { id: "asc" },
  });
  if (!cashier) {
    console.warn("  skip sample sales: no user with sales.create permission");
    return 0;
  }

  const branches = await prisma.branch.findMany({
    where: { isWarehouse: false },
    orderBy: { id: "asc" },
  });
  if (!branches.length) {
    console.warn("  skip sample sales: no non-warehouse branches");
    return 0;
  }

  const products = await prisma.product.findMany({
    where: { isActive: true, stockLevels: { some: { quantity: { gt: 5 } } } },
    include: { stockLevels: true },
  });
  if (products.length < 2) {
    console.warn("  skip sample sales: not enough products with stock");
    return 0;
  }

  const customers = await prisma.customer.findMany({ take: 10, orderBy: { id: "asc" } });

  const rand = makeRandom(42);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  let created = 0;
  const now = new Date();

  const createSale = async (
    branchId: number,
    backdateTo: Date | null,
    options: { partial?: boolean } = {},
  ): Promise<void> => {
    const inBranch = products.filter((p) =>
      p.stockLevels.some((sl) => sl.branchId === branchId && sl.quantity > 5),
    );
    if (!inBranch.length) return;

    const wanted = Math.floor(rand() * 2) + 1; // 1–2 distinct products
    const used = new Set<number>();
    const items: { productId: number; quantity: number }[] = [];
    let priceSum = 0;
    for (let attempt = 0; attempt < wanted * 4 && items.length < wanted; attempt++) {
      const p = pick(inBranch);
      if (used.has(p.id)) continue;
      used.add(p.id);
      const qty = Math.floor(rand() * 2) + 1; // 1–2
      items.push({ productId: p.id, quantity: qty });
      priceSum += p.basePrice * qty;
    }
    if (!items.length) return;

    const customerId = customers.length && rand() > 0.4 ? pick(customers).id : undefined;
    const amount = options.partial ? Math.floor(priceSum * 0.5) : priceSum;

    try {
      const sale = await checkout({
        branchId,
        cashierId: cashier.id,
        customerId,
        items,
        payments: [{ method: "CASH", amount }],
        maxDiscountPercent: null,
      });
      if (backdateTo) {
        await prisma.sale.update({
          where: { id: sale.id },
          data: { createdAt: backdateTo },
        });
      }
      created++;
    } catch (err) {
      if (err instanceof CheckoutError) return; // silently skip insufficient stock etc.
      throw err;
    }
  };

  for (let monthsAgo = 5; monthsAgo >= 1; monthsAgo--) {
    for (let i = 0; i < 2; i++) {
      const branch = pick(branches);
      const date = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - monthsAgo,
          Math.floor(rand() * 25) + 1,
          Math.floor(rand() * 8) + 10,
        ),
      );
      await createSale(branch.id, date);
    }
  }

  for (let i = 0; i < 3 && i < branches.length; i++) {
    await createSale(branches[i].id, null);
  }
  await createSale(branches[0].id, null, { partial: true });

  return created;
}

async function seedSampleDeliveries(prisma: PrismaClient): Promise<number> {
  const [zones, channels] = await Promise.all([
    prisma.deliveryZone.findMany({ orderBy: { id: "asc" } }),
    prisma.deliveryChannel.findMany({ orderBy: { id: "asc" } }),
  ]);
  if (!zones.length || !channels.length) {
    console.warn("  skip sample deliveries: no zones or channels");
    return 0;
  }

  const recentSales = await prisma.sale.findMany({
    where: { delivery: null, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { customer: true },
  });

  const rand = makeRandom(99);
  let created = 0;

  for (const sale of recentSales.slice(0, 3)) {
    const zone = zones[Math.floor(rand() * zones.length)];
    const channel = channels[Math.floor(rand() * channels.length)];
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + 3 + Math.floor(rand() * 14));

    try {
      await prisma.delivery.create({
        data: {
          saleId: sale.id,
          zoneId: zone.id,
          channelId: channel.id,
          status: "PENDING",
          scheduledDate: scheduled,
          addressText: "ที่อยู่ตัวอย่าง 123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพฯ",
          recipientName: sale.customer?.name ?? null,
          recipientPhone: sale.customer?.phone ?? null,
          fee: zone.fee,
        },
      });
      created++;
    } catch {
      // skip duplicate / FK errors
    }
  }
  return created;
}

async function run(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const withUsers = process.argv.includes("--with-users");
  const withSampleSales = process.argv.includes("--with-sample-sales");

  console.log(
    `migrate-from-legacy ${dryRun ? "(dry-run)" : ""}${withUsers ? " --with-users" : ""}${withSampleSales ? " --with-sample-sales" : ""}`,
  );
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

    if (withSampleSales && !dryRun) {
      const salesCreated = await seedSampleSales(prisma);
      lines.push(`  sample sales       created=${salesCreated}`);
      if (salesCreated > 0) {
        const deliveriesCreated = await seedSampleDeliveries(prisma);
        lines.push(`  sample deliveries  created=${deliveriesCreated}`);
      }
    } else if (withSampleSales && dryRun) {
      lines.push("  sample sales       skipped (incompatible with --dry-run)");
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
