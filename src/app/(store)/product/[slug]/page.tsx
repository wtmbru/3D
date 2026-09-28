import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Configurator } from "@/components/configurator/Configurator";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/data/constants";
import { parseDesign } from "@/lib/config";
import { getCatalog, getProductBySlug, getProducts } from "@/lib/server/catalog";

export async function generateMetadata(props: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  return product ? { title: product.name, description: product.tagline } : {};
}

export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [catalog, products] = await Promise.all([getCatalog(), getProducts()]);
  const initial = parseDesign(catalog, product, await props.searchParams);
  const category = categories.find((c) => c.id === product.category);
  const related = products.filter((p) => p.slug !== product.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm font-semibold text-ink-soft">
        <Link href="/shop" className="hover:text-ink">Shop</Link>
        <span className="mx-2">/</span>
        {category && (
          <>
            <Link href={`/shop?category=${category.id}`} className="hover:text-ink">{category.label}</Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-ink">{product.name}</span>
      </nav>

      <Configurator product={product} initialFamily={initial.family} initialConfig={initial.config} />

      <section className="mt-24">
        <h2 className="font-display text-3xl font-extrabold tracking-tight">You might also like</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i + 1} />
          ))}
        </div>
      </section>
    </div>
  );
}
