import type { AddonSelection, Catalog, ColorConfig, Filament, MaterialFamily, Product } from "./types";
import { addonLines, resolveVariant, variantsOf } from "./variants";

/** One AMS unit = 4 spools, so one print can use up to 4 filaments. */
export const MAX_COLORS = 4;

/** Extra charge per color beyond the first (AMS swaps waste filament). */
export const EXTRA_COLOR_FEE = 1;

export interface PriceLine {
  label: string;
  amount: number;
}

export interface PriceQuote {
  unit: number;
  lines: PriceLine[];
}

const lookups = new WeakMap<Filament[], Map<string, Filament>>();

export function getFilament(catalog: Catalog, id: string | undefined): Filament | undefined {
  if (!id) return undefined;
  let map = lookups.get(catalog.filaments);
  if (!map) {
    map = new Map(catalog.filaments.map((f) => [f.id, f]));
    lookups.set(catalog.filaments, map);
  }
  return map.get(id);
}

export function distinctFilaments(config: ColorConfig): string[] {
  return [...new Set(Object.values(config))];
}

export const plateOf = (part: { plate?: number }) => part.plate ?? 1;

/** Distinct filaments used by each print job (plate), in plate order. */
export function colorsByPlate(product: Pick<Product, "parts">, config: ColorConfig): Map<number, string[]> {
  const plates = new Map<number, Set<string>>();
  for (const part of product.parts) {
    const id = config[part.id] ?? part.defaultFilament;
    if (!id) continue;
    const plate = plateOf(part);
    if (!plates.has(plate)) plates.set(plate, new Set());
    plates.get(plate)!.add(id);
  }
  return new Map([...plates].sort(([a], [b]) => a - b).map(([k, v]) => [k, [...v]]));
}

/** Plates that use more colors than one AMS holds. */
export function platesOverLimit(product: Pick<Product, "parts">, config: ColorConfig): number[] {
  return [...colorsByPlate(product, config)].filter(([, ids]) => ids.length > MAX_COLORS).map(([plate]) => plate);
}

/** Price for one design. `product` is a resolved option (see resolveVariant). */
export function quote(
  catalog: Catalog,
  product: Product,
  family: MaterialFamily,
  config: ColorConfig,
  addons: AddonSelection = {},
): PriceQuote {
  const lines: PriceLine[] = [{ label: "Base price", amount: product.basePrice }];

  const mat = catalog.materials.find((m) => m.family === family);
  if (mat && mat.surcharge > 0) lines.push({ label: `${mat.label} material`, amount: mat.surcharge });

  // Color swaps happen within each print, so the fee is per plate.
  const plates = colorsByPlate(product, config);
  const extraColors = [...plates.values()].reduce((n, ids) => n + Math.max(0, ids.length - 1), 0);
  if (extraColors > 0) {
    const label = plates.size > 1 ? `${extraColors} extra colors (${plates.size} prints)` : `${extraColors + 1} colors`;
    lines.push({ label, amount: extraColors * EXTRA_COLOR_FEE });
  }

  const used = distinctFilaments(config);

  for (const id of used) {
    const f = getFilament(catalog, id);
    if (f && f.surcharge > 0) lines.push({ label: f.name, amount: f.surcharge });
  }

  lines.push(...addonLines(product, addons));

  return { unit: lines.reduce((sum, l) => sum + l.amount, 0), lines };
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Price shown on cards: the cheapest option in its default colors. */
export function startingPrice(catalog: Catalog, product: Product): number {
  return Math.min(
    ...variantsOf(product).map((v) => {
      const view = resolveVariant(product, v.id);
      return quote(catalog, view, view.materials[0], defaultConfig(view)).unit;
    }),
  );
}

export function defaultConfig(product: Product): ColorConfig {
  return Object.fromEntries(product.parts.map((p) => [p.id, p.defaultFilament]));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Closest in-stock filament in another material family (used when switching PLA → PETG).
 * Prefers keeping opaque colors opaque — a translucent stand-in looks very different —
 * and plain filament over premium finishes when colors are close.
 */
export function nearestFilament(
  catalog: Catalog,
  hex: string,
  family: MaterialFamily,
  translucent = false,
): Filament | undefined {
  const [r, g, b] = hexToRgb(hex);
  let best: Filament | undefined;
  let bestDist = Infinity;
  for (const f of catalog.filaments) {
    if (f.family !== family || !f.inStock) continue;
    const [r2, g2, b2] = hexToRgb(f.hex);
    // Weighted RGB distance — cheap and good enough for picking a stand-in.
    const finishPenalty = (f.finish === "translucent") !== translucent ? 60_000 : 0;
    // On near-ties, prefer plain filament over premium finishes (silk, sparkle…).
    const pricePenalty = f.surcharge * 1_500;
    const d = 2 * (r - r2) ** 2 + 4 * (g - g2) ** 2 + 3 * (b - b2) ** 2 + finishPenalty + pricePenalty;
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}
