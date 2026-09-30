import type { MaterialFamily } from "./types";

/*
 * Private weight and cost estimates for the shop owner (never shown to customers).
 * A rough guide, not a substitute for the slicer's number: it assumes how solid a
 * typical print is and adds a little for waste.
 */

export interface CostSettings {
  /** What a kilo of filament costs her, per material. */
  perKg: Record<MaterialFamily, number>;
  /** How much of a model's volume is actually plastic (walls, infill and top layers), in percent. */
  solidPct: number;
  /** Extra plastic for supports, purging between colors and failed starts, in percent. */
  wastePct: number;
}

export const DEFAULT_COSTS: CostSettings = { perKg: { PLA: 20, PETG: 22, TPU: 30 }, solidPct: 35, wastePct: 10 };

/** Plastic density in g/cm³. */
const DENSITY: Record<MaterialFamily, number> = { PLA: 1.24, PETG: 1.27, TPU: 1.21 };

const num = (v: unknown, fallback: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : fallback);

/** Fills in anything missing or nonsensical from stored settings. */
export function normalizeCosts(raw: unknown): CostSettings {
  const r = (raw ?? {}) as Partial<CostSettings> & { perKg?: Partial<Record<MaterialFamily, unknown>> };
  return {
    perKg: {
      PLA: num(r.perKg?.PLA, DEFAULT_COSTS.perKg.PLA, 1000),
      PETG: num(r.perKg?.PETG, DEFAULT_COSTS.perKg.PETG, 1000),
      TPU: num(r.perKg?.TPU, DEFAULT_COSTS.perKg.TPU, 1000),
    },
    solidPct: num(r.solidPct, DEFAULT_COSTS.solidPct, 100),
    wastePct: num(r.wastePct, DEFAULT_COSTS.wastePct, 100),
  };
}

/** Estimated grams of filament for a model of this volume (mm³), and what that plastic costs. */
export function estimatePrint(volumeMm3: number, family: MaterialFamily, s: CostSettings): { grams: number; cost: number } {
  const grams = (volumeMm3 / 1000) * DENSITY[family] * (s.solidPct / 100) * (1 + s.wastePct / 100);
  return { grams, cost: (grams / 1000) * s.perKg[family] };
}
