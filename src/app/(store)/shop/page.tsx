import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/data/constants";
import { getProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Shop" };

export default async function ShopPage(props: PageProps<"/shop">) {
  const { category } = await props.searchParams;
  const products = await getProducts();
  const active = categories.find((c) => c.id === category);
  const list = active ? products.filter((p) => p.category === active.id) : products;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The shop</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">
        {active ? active.label : "Everything"}
      </h1>
      <p className="mt-3 max-w-xl text-lg text-ink-soft">
        Every design can be customized part by part. Pick one to start painting.
      </p>

      <nav aria-label="Categories" className="mt-8 flex flex-wrap gap-2">
        <FilterChip href="/shop" active={!active}>
          All
        </FilterChip>
        {categories.map((c) => (
          <FilterChip key={c.id} href={`/shop?category=${c.id}`} active={active?.id === c.id}>
            <span aria-hidden="true">{c.emoji}</span> {c.label}
          </FilterChip>
        ))}
      </nav>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p, i) => (
          <ProductCard key={p.slug} product={p} index={i} />
        ))}
      </div>
      {list.length === 0 && (
        <p className="mt-10 text-ink-soft">Nothing here yet. New designs are on the printer!</p>
      )}
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`chip focus-ring px-4 py-1.5 transition-transform hover:-translate-y-0.5 ${
        active ? "bg-ink text-cream" : "bg-paper"
      }`}
    >
      {children}
    </Link>
  );
}
