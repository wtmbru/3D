import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/baseUrl";
import { getProducts } from "@/lib/server/catalog";

// Read per visit, like the store pages, so building never depends on the database.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ["", "/shop", "/colors", "/custom"].map((p) => ({ url: `${baseUrl}${p}` }));
  try {
    const products = await getProducts();
    return [...pages, ...products.map((p) => ({ url: `${baseUrl}/product/${p.slug}` }))];
  } catch {
    return pages; // still useful without the product list if the database is unreachable
  }
}
