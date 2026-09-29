import type { AddonSelection, ColorConfig, Product, ProductVariant, VariantFields } from "./types";

/*
 * Options (variants) sit on top of the single-option product model: resolve a
 * variant into an ordinary Product view and everything downstream (viewer,
 * pricing, thumbnails, color picker) works unchanged.
 */

export const DEFAULT_VARIANT = "default";

/** Just the per-option model fields of a product or option. */
export const variantFields = (v: VariantFields): VariantFields => ({
  basePrice: v.basePrice,
  parts: v.parts,
  presets: v.presets,
  dimensions: v.dimensions,
  layout: v.layout,
});

/** Every option of a product. A plain product has one, "default". */
export function variantsOf(product: Product): ProductVariant[] {
  if (product.variants && product.variants.length > 0) return product.variants;
  return [{ id: DEFAULT_VARIANT, name: product.name, ...variantFields(product) }];
}

export const hasOptions = (product: Product) => variantsOf(product).length > 1;

export function findVariant(product: Product, id: string | undefined): ProductVariant {
  const all = variantsOf(product);
  return all.find((v) => v.id === id) ?? all[0];
}

/** The product as it looks with one option selected. */
export function resolveVariant(product: Product, variantId: string | undefined): Product {
  const v = findVariant(product, variantId);
  return { ...product, ...variantFields(v) };
}

/** Cheapest option's base price, for "from $X". */
export function lowestBasePrice(product: Product): number {
  return Math.min(...variantsOf(product).map((v) => v.basePrice));
}

/** Customer-facing count like "5 sizes" or "3 options". */
export function optionsBadge(product: Product): string | null {
  const n = variantsOf(product).length;
  if (n < 2) return null;
  const label = (product.variantLabel || "option").trim().toLowerCase();
  return `${n} ${label.endsWith("s") ? label : `${label}s`}`;
}

// ── Add-ons ──────────────────────────────────────────────────────────────────

/** Default choice (first) for every add-on group, overridden by valid picks. */
export function normalizeAddons(product: Product, picked: AddonSelection = {}): AddonSelection {
  const out: AddonSelection = {};
  for (const g of product.addons ?? []) {
    if (!g.choices.length) continue;
    out[g.id] = g.choices.some((c) => c.id === picked[g.id]) ? picked[g.id] : g.choices[0].id;
  }
  return out;
}

export function addonLines(product: Product, picked: AddonSelection): { label: string; amount: number }[] {
  const lines: { label: string; amount: number }[] = [];
  for (const g of product.addons ?? []) {
    const c = g.choices.find((x) => x.id === picked[g.id]);
    if (c && c.price > 0) lines.push({ label: `${g.name}: ${c.name}`, amount: c.price });
  }
  return lines;
}

/** Human-readable add-on picks for the cart, skipping $0 defaults like "None". */
export function describeAddons(product: Product, picked: AddonSelection): string[] {
  return (product.addons ?? []).flatMap((g) => {
    const c = g.choices.find((x) => x.id === picked[g.id]);
    return c && (c.price > 0 || c !== g.choices[0]) ? [`${g.name}: ${c.name}`] : [];
  });
}

// ── Switching options ────────────────────────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Carry colors to another option: parts match by id, then by name
 * ("Body" stays pink when switching 2×2 → 2×3); single-part options carry
 * the previous main color.
 */
export function carryColors(from: Product, config: ColorConfig, to: Product): ColorConfig {
  const out: ColorConfig = {};
  const byName = new Map(from.parts.map((p) => [norm(p.name), config[p.id]]));
  const main = from.parts[0] ? config[from.parts[0].id] : undefined;
  for (const part of to.parts) {
    if (part.locked) continue;
    const carried =
      config[part.id] ?? byName.get(norm(part.name)) ?? (to.parts.length === 1 || from.parts.length === 1 ? main : undefined);
    if (carried) out[part.id] = carried;
  }
  return out;
}
