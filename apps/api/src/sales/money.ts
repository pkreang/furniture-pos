export const VAT_RATE = 0.07;
export const POINTS_PER_BAHT = 1 / 100; // 1 point per 100 baht spent

/** Splits a VAT-inclusive gross amount into its tax base and VAT portion. */
export function extractVat(gross: number): { taxBase: number; vatAmount: number } {
  const taxBase = Math.round(gross / (1 + VAT_RATE));
  return { taxBase, vatAmount: gross - taxBase };
}

/** Loyalty points earned for an amount actually paid. */
export function calcPointsEarned(amountPaid: number): number {
  return Math.floor(amountPaid * POINTS_PER_BAHT);
}
