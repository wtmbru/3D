import Link from "next/link";
import { formatPrice, getFilament, startingPrice } from "@/lib/pricing";
import { getCatalog } from "@/lib/server/catalog";
import type { Product } from "@/lib/types";
import { optionsBadge } from "@/lib/variants";
import { ProductThumb } from "./ProductThumb";
import { SwatchDot } from "./Swatch";

const tileColors = ["bg-sky-soft", "bg-sun-soft", "bg-mint-soft", "bg-bubble-soft", "bg-grape-soft", "bg-tomato-soft"];

export async function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const catalog = await getCatalog();
  const options = optionsBadge(product);
  const defaults = product.parts
    .map((p) => getFilament(catalog, p.defaultFilament))
    .filter((f, i, all) => f && all.findIndex((g) => g?.id === f.id) === i);

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group chunky focus-ring block overflow-hidden rounded-[var(--radius-blob)] bg-paper transition-transform duration-200 hover:-translate-y-1 hover:rotate-[-0.6deg]"
    >
      <div className={`layer-lines relative aspect-square border-b-2 border-ink ${tileColors[index % tileColors.length]}`}>
        <ProductThumb
          product={product}
          className="absolute inset-[8%] transition-transform duration-300 group-hover:scale-105"
        />
        {product.badge && (
          <span className="chip absolute top-3 left-3 rotate-[-4deg] bg-sun text-xs shadow-[var(--shadow-pop-sm)]">
            {product.badge}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-tight font-extrabold">{product.name}</h3>
          <span className="shrink-0 font-display font-bold">
            <span className="text-xs font-semibold text-ink-soft">from </span>
            {formatPrice(startingPrice(catalog, product))}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{product.tagline}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {defaults.map((f) => f && <SwatchDot key={f.id} filament={f} size={18} />)}
          </div>
          <span className="text-xs font-semibold text-ink-soft">
            {product.parts.length} customizable {product.parts.length === 1 ? "part" : "parts"}
          </span>
          {options && <span className="chip ml-auto bg-grape-soft px-2 py-0.5 text-xs">{options}</span>}
        </div>
      </div>
    </Link>
  );
}
