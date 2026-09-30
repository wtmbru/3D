import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/data/constants";
import { pageMeta } from "@/lib/meta";
import { getProducts } from "@/lib/server/catalog";

export const metadata: Metadata = pageMeta("Shop", "Browse playful 3D-printed goods. Pick a design and choose every color yourself.", "/shop");

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

      <div className="chunky layer-lines mt-16 flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-blob)] bg-grape-soft p-6 sm:p-8">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl font-extrabold">Don&apos;t see the one you want?</h2>
          <p className="mt-2 text-ink-soft">
            Found a print somewhere else? Send us the link and tell us your colors. We&apos;ll take a look and reply with a price.
          </p>
        </div>
        <Link href="/custom" className="btn btn-primary">
          Request a custom print →
        </Link>
      </div>
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
