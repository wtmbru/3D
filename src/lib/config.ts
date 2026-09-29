import { defaultConfig, getFilament, nearestFilament, platesOverLimit } from "./pricing";
import type { AddonSelection, Catalog, ColorConfig, MaterialFamily, Product } from "./types";
import { findVariant, hasOptions, normalizeAddons, resolveVariant } from "./variants";

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Default colors for a product, remapped into another material family if needed. */
export function defaultsFor(catalog: Catalog, product: Product, family: MaterialFamily): ColorConfig {
  return remapToFamily(catalog, product, defaultConfig(product), family);
}

export function remapToFamily(
  catalog: Catalog,
  product: Product,
  config: ColorConfig,
  family: MaterialFamily,
): ColorConfig {
  const out: ColorConfig = {};
  for (const part of product.parts) {
    const f = getFilament(catalog, config[part.id] ?? part.defaultFilament);
    out[part.id] =
      f && f.family === family
        ? f.id
        : (nearestFilament(catalog, f?.hex ?? "#888888", family, f?.finish === "translucent")?.id ??
          part.defaultFilament);
  }
  return out;
}

export interface Design {
  variantId: string;
  family: MaterialFamily;
  config: ColorConfig;
  addons: AddonSelection;
}

/**
 * Read a design from URL params (`?v=2x2&material=PETG&pot=petg-teal&a-ring=keyring`).
 * Anything invalid (unknown option or color, wrong material, out of stock,
 * locked part) falls back to the default.
 */
export function parseDesign(catalog: Catalog, fullProduct: Product, params: Params): Design {
  const variantId = findVariant(fullProduct, first(params.v)).id;
  const product = resolveVariant(fullProduct, variantId);
  const addons = normalizeAddons(
    fullProduct,
    Object.fromEntries((fullProduct.addons ?? []).map((g) => [g.id, first(params[`a-${g.id}`]) ?? ""])),
  );
  const requested = first(params.material) as MaterialFamily | undefined;
  const family = requested && product.materials.includes(requested) ? requested : product.materials[0];
  const config = defaultsFor(catalog, product, family);

  for (const part of product.parts) {
    if (part.locked) continue;
    const f = getFilament(catalog, first(params[part.id]));
    if (f && f.family === family && f.inStock) config[part.id] = f.id;
  }

  if (platesOverLimit(product, config).length) {
    return { variantId, family, config: defaultsFor(catalog, product, family), addons };
  }
  return { variantId, family, config, addons };
}

export function designSearch(fullProduct: Product, design: Design): string {
  const { variantId, family, config, addons } = design;
  const product = resolveVariant(fullProduct, variantId);
  const params = new URLSearchParams();
  if (hasOptions(fullProduct)) params.set("v", variantId);
  if (family !== product.materials[0]) params.set("material", family);
  for (const part of product.parts) {
    if (!part.locked && config[part.id]) params.set(part.id, config[part.id]);
  }
  const defaults = normalizeAddons(fullProduct);
  for (const [group, choice] of Object.entries(addons)) {
    if (defaults[group] !== choice) params.set(`a-${group}`, choice);
  }
  return params.toString();
}

export function designHref(fullProduct: Product, design: Design): string {
  return `/product/${fullProduct.slug}?${designSearch(fullProduct, design)}`;
}
