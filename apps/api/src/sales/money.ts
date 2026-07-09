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

export interface DiscountResult {
  /** Total baht taken off the base. */
  discount: number;
  /** Base after the discount (base − discount). */
  net: number;
}

/**
 * Applies a two-part discount: a fixed baht amount FIRST, then a percentage of
 * the remainder. Both are clamped so the result never goes below zero. e.g.
 * base 1000, 100 baht then 10% → 100 off, then 10% of 900 = 90 → net 810.
 */
export function applyDiscount(base: number, baht: number, percent: number): DiscountResult {
  if (base <= 0) return { discount: 0, net: 0 };
  const amt = Math.min(Math.max(Math.round(baht), 0), base);
  const afterAmount = base - amt;
  const pct = Math.min(Math.max(percent, 0), 100);
  const pctCut = Math.round((afterAmount * pct) / 100);
  const net = afterAmount - pctCut;
  return { discount: base - net, net };
}

/**
 * The effective percentage a resolved baht discount represents of its base —
 * used to enforce the role's percent discount cap uniformly.
 */
export function effectiveDiscountPercent(resolved: number, base: number): number {
  if (base <= 0) return 0;
  return (resolved / base) * 100;
}
