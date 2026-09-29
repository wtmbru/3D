import type { Product } from "./types";

/**
 * Which product the homepage shows big at the top.
 *
 * An explicit pick (the star in Admin → Products) wins as long as that product
 * is still published. Otherwise fall back to the first featured product with
 * color palettes to cycle through, then any featured one, then the first product.
 * `products` must be the published ones, in shop order.
 */
export function pickHero(products: Product[], heroProductId?: string | null): Product | undefined {
  const featured = products.filter((p) => p.featured);
  return (
    (heroProductId ? products.find((p) => p.id === heroProductId) : undefined) ??
    featured.find((p) => p.presets.length > 1) ??
    featured[0] ??
    products[0]
  );
}
