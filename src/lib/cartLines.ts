import { quote } from "./pricing";
import type { CartItem } from "./cart";
import type { Catalog, Product } from "./types";
import { resolveVariant, variantsOf } from "./variants";

export interface CartLine {
  item: CartItem;
  /** The full product, with all its options. */
  full: Product;
  /** The option this line is for, as a plain product. */
  product: Product;
  unit: number;
}

/**
 * Cart items → priced lines. Items whose product (or option) was removed or
 * unpublished are dropped. Prices always come from the current catalog.
 */
export function resolveCartLines(catalog: Catalog, products: Product[], items: CartItem[]): CartLine[] {
  const lines: CartLine[] = [];
  for (const item of items) {
    const full = products.find((p) => p.slug === item.slug);
    if (!full) continue;
    if (item.variant && !variantsOf(full).some((v) => v.id === item.variant)) continue;
    const product = resolveVariant(full, item.variant);
    lines.push({ item, full, product, unit: quote(catalog, product, item.family, item.config, item.addons).unit });
  }
  return lines;
}
