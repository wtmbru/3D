import type { Metadata } from "next";
import Link from "next/link";
import { ProductThumb } from "@/components/ProductThumb";
import { categories } from "@/data/constants";
import { formatPrice, startingPrice } from "@/lib/pricing";
import { getCatalog, getProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const [catalog, products] = await Promise.all([getCatalog(), getProducts(true)]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Products</h1>
          <p className="mt-2 text-ink-soft">
            {products.length} {products.length === 1 ? "design" : "designs"}. Drafts are hidden from customers.
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary btn-sm">
          + New product
        </Link>
      </div>

      <ul className="mt-8 divide-y-2 divide-ink/10 overflow-hidden rounded-3xl border-2 border-ink bg-paper">
        {products.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/products/${p.id}`} className="focus-ring flex items-center gap-4 px-4 py-3 transition-colors hover:bg-cream">
              <ProductThumb product={p} className="h-16 w-16 shrink-0 rounded-2xl bg-sky-soft" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold">{p.name}</p>
                <p className="truncate text-sm text-ink-soft">
                  {categories.find((c) => c.id === p.category)?.label} · {p.parts.length}{" "}
                  {p.parts.length === 1 ? "part" : "parts"} · {p.materials.join(", ")}
                </p>
              </div>
              <span className="hidden font-display font-bold tabular-nums sm:block">
                {formatPrice(startingPrice(catalog, p))}
              </span>
              <span className={`chip text-xs ${p.published ? "bg-mint-soft" : "bg-sun-soft"}`}>
                {p.published ? "Live" : "Draft"}
              </span>
              {p.featured && <span className="chip hidden bg-grape-soft text-xs md:inline-flex">Featured</span>}
            </Link>
          </li>
        ))}
        {products.length === 0 && (
          <li className="p-10 text-center text-ink-soft">No products yet. Add your first design!</li>
        )}
      </ul>
    </div>
  );
}
