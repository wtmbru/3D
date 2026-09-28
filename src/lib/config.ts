import { defaultConfig, getFilament, nearestFilament, platesOverLimit } from "./pricing";
import type { Catalog, ColorConfig, MaterialFamily, Product } from "./types";

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

/**
 * Read a design from URL params (`?material=PETG&pot=petg-teal`). Anything
 * invalid (unknown color, wrong material, out of stock, locked part) falls
 * back to the default for that part.
 */
export function parseDesign(
  catalog: Catalog,
  product: Product,
  params: Params,
): { family: MaterialFamily; config: ColorConfig } {
  const requested = first(params.material) as MaterialFamily | undefined;
  const family = requested && product.materials.includes(requested) ? requested : product.materials[0];
  const config = defaultsFor(catalog, product, family);

  for (const part of product.parts) {
    if (part.locked) continue;
    const f = getFilament(catalog, first(params[part.id]));
    if (f && f.family === family && f.inStock) config[part.id] = f.id;
  }

  if (platesOverLimit(product, config).length) {
    return { family, config: defaultsFor(catalog, product, family) };
  }
  return { family, config };
}

export function designSearch(product: Product, family: MaterialFamily, config: ColorConfig): string {
  const params = new URLSearchParams();
  if (family !== product.materials[0]) params.set("material", family);
  for (const part of product.parts) {
    if (!part.locked && config[part.id]) params.set(part.id, config[part.id]);
  }
  return params.toString();
}

export function designHref(product: Product, family: MaterialFamily, config: ColorConfig): string {
  return `/product/${product.slug}?${designSearch(product, family, config)}`;
}
