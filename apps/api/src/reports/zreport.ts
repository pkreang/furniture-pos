import { Prisma, type PrismaClient, type ZReport } from "@prisma/client";

/** Raised for any Z-report rule violation; `code` is a stable error code. */
export class ZReportError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface GenerateArgs {
  branchId: number;
  /** The business date at UTC midnight. */
  businessDate: Date;
  generatedById: number;
}

/** UTC `[date, date + 24h)` window for a business date. */
function dayWindow(date: Date): { gte: Date; lt: Date } {
  const gte = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

/**
 * Generates an immutable Z-report: aggregates a branch's sales for one
 * business date into a single `z_reports` row, unique per branch + date.
 */
export async function generateZReport(prisma: PrismaClient, args: GenerateArgs): Promise<ZReport> {
  const window = dayWindow(args.businessDate);
  const inWindow = { branchId: args.branchId, createdAt: window };

  const completed = await prisma.sale.aggregate({
    where: { ...inWindow, status: "COMPLETED" },
    _count: true,
    _sum: { total: true, vatAmount: true, discountAmount: true },
  });
  const voided = await prisma.sale.aggregate({
    where: { ...inWindow, status: "VOIDED" },
    _count: true,
    _sum: { total: true },
  });
  const byMethod = await prisma.payment.groupBy({
    by: ["method"],
    where: { sale: { ...inWindow, status: "COMPLETED" } },
    _sum: { amount: true },
  });
  const methodTotal = (m: "CASH" | "TRANSFER" | "CARD"): number =>
    byMethod.find((row) => row.method === m)?._sum.amount ?? 0;

  try {
    return await prisma.zReport.create({
      data: {
        branchId: args.branchId,
        businessDate: window.gte,
        generatedById: args.generatedById,
        salesCount: completed._count,
        grossTotal: completed._sum.total ?? 0,
        vatTotal: completed._sum.vatAmount ?? 0,
        discountTotal: completed._sum.discountAmount ?? 0,
        cashTotal: methodTotal("CASH"),
        transferTotal: methodTotal("TRANSFER"),
        cardTotal: methodTotal("CARD"),
        voidedCount: voided._count,
        voidedTotal: voided._sum.total ?? 0,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ZReportError("ALREADY_EXISTS", "ออก Z-report ของวันนี้ไปแล้ว");
    }
    throw err;
  }
}
