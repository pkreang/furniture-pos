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

export type DiscountKind = "AMOUNT" | "PERCENT";

/**
 * Resolves a discount expressed as either a fixed baht amount or a percentage
 * into a baht figure, clamped to `[0, base]` so it can never exceed the amount
 * being discounted or go negative.
 */
export function resolveDiscount(type: DiscountKind, value: number, base: number): number {
  if (base <= 0 || value <= 0) return 0;
  const raw = type === "PERCENT" ? Math.round((base * value) / 100) : Math.round(value);
  return Math.min(Math.max(raw, 0), base);
}

/**
 * The effective percentage a resolved baht discount represents of its base —
 * used to enforce the role's percent discount cap uniformly, whether the user
 * entered a percentage or a baht amount.
 */
export function effectiveDiscountPercent(resolved: number, base: number): number {
  if (base <= 0) return 0;
  return (resolved / base) * 100;
}
