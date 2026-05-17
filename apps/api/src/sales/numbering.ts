import type { Prisma } from "@prisma/client";

/**
 * Allocates the next document number for a branch + kind, inside a transaction.
 * The `update` with an `increment` locks the row, so concurrent checkouts get
 * distinct numbers; a rolled-back transaction un-consumes the number.
 */
export async function nextNumber(
  tx: Prisma.TransactionClient,
  branchId: number,
  kind: string,
): Promise<number> {
  await tx.numberSequence.upsert({
    where: { branchId_kind: { branchId, kind } },
    update: {},
    create: { branchId, kind, next: 1 },
  });
  const updated = await tx.numberSequence.update({
    where: { branchId_kind: { branchId, kind } },
    data: { next: { increment: 1 } },
  });
  return updated.next - 1;
}

/** Formats a sale number, e.g. `formatSaleNumber("BKK01", 1)` → `"BKK01-000001"`. */
export function formatSaleNumber(branchCode: string, n: number): string {
  return `${branchCode}-${String(n).padStart(6, "0")}`;
}

/** Formats a quotation number, e.g. `formatQuotationNumber("BKK01", 1)` → `"BKK01-Q000001"`. */
export function formatQuotationNumber(branchCode: string, n: number): string {
  return `${branchCode}-Q${String(n).padStart(6, "0")}`;
}
