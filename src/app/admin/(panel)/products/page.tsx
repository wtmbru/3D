import type { Metadata } from "next";
import Link from "next/link";
import { pickHero } from "@/lib/hero";
import { getCatalog, getProducts } from "@/lib/server/catalog";
import { getHomeSettings } from "@/lib/server/settings";
import { ProductsList } from "./ProductsList";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const [catalog, products, home] = await Promise.all([getCatalog(), getProducts(true), getHomeSettings()]);
  const published = products.filter((p) => p.published);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Products</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            {products.length} {products.length === 1 ? "design" : "designs"}. Drag to change the order customers see. Drafts are
            hidden. Tap the star to put a print at the top of the homepage.
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary btn-sm">
          + New product
        </Link>
      </div>

      <ProductsList
        products={products}
        catalog={catalog}
        chosenHeroId={published.some((p) => p.id === home.heroProductId) ? home.heroProductId : null}
        autoHeroId={pickHero(published, null)?.id ?? null}
      />
    </div>
  );
}
