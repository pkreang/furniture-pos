import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../auth/password.js";
import { PERMISSIONS, ROLES, SOFA_MATERIALS, APP_SETTINGS } from "./catalog.js";

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

  for (const m of SOFA_MATERIALS) {
    const material = await prisma.sofaMaterial.upsert({
      where: { key: m.key },
      update: { name: m.name, priceMultiplierPct: m.priceMultiplierPct },
      create: { key: m.key, name: m.name, priceMultiplierPct: m.priceMultiplierPct },
    });
    await prisma.sofaColor.deleteMany({ where: { materialId: material.id } });
    await prisma.sofaColor.createMany({
      data: m.colors.map((name) => ({ materialId: material.id, name })),
    });
  }

  for (const [key, value] of Object.entries(APP_SETTINGS)) {
    await prisma.appSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
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
