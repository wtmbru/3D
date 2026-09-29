"use client";

import { ProductThumb } from "@/components/ProductThumb";
import { formatPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { resolveVariant, variantsOf } from "@/lib/variants";

/** Pick between a product's options (sizes, shapes…), each with a little 3D preview. */
export function OptionPicker({
  product,
  selected,
  onSelect,
}: {
  product: Product;
  selected: string;
  onSelect: (variantId: string) => void;
}) {
  const variants = variantsOf(product);
  const label = product.variantLabel || "Option";
  const current = variants.find((v) => v.id === selected);
  const samePrice = variants.every((v) => v.basePrice === variants[0].basePrice);

  return (
    <fieldset className="mt-8">
      <legend className="eyebrow">
        {label}
        {current && <span className="ml-2 font-sans font-semibold tracking-normal text-ink normal-case">{current.name}</span>}
      </legend>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={label}>
        {variants.map((v) => {
          const on = v.id === selected;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(v.id)}
              className={`focus-ring flex flex-col items-center rounded-2xl border-2 p-2 text-center transition-transform hover:-translate-y-0.5 ${
                on ? "border-ink bg-sky-soft shadow-[var(--shadow-pop-sm)]" : "border-ink/20 bg-paper"
              }`}
            >
              <ProductThumb product={resolveVariant(product, v.id)} preferPhoto={false} className="aspect-square w-full" />
              <span className="mt-1 line-clamp-1 text-sm font-bold">{v.name}</span>
              {!samePrice && <span className="text-xs text-ink-soft tabular-nums">{formatPrice(v.basePrice)}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
