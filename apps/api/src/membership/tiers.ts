export interface TierDef {
  key: string;
  name: string;
  minSpend: number;
}

export const TIERS: TierDef[] = [
  { key: "bronze", name: "บรอนซ์", minSpend: 0 },
  { key: "silver", name: "ซิลเวอร์", minSpend: 30000 },
  { key: "gold", name: "โกลด์", minSpend: 100000 },
  { key: "platinum", name: "แพลทินัม", minSpend: 300000 },
];

/** Highest tier whose minSpend the lifetime spend reaches. TIERS is ascending. */
export function getTier(lifetimeSpend: number): TierDef {
  let result = TIERS[0];
  for (const t of TIERS) {
    if (lifetimeSpend >= t.minSpend) result = t;
  }
  return result;
}
