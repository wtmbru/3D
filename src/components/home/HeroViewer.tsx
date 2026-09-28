"use client";

import { useEffect, useState } from "react";
import { SwatchDot } from "@/components/Swatch";
import { ModelViewer } from "@/components/viewer/ModelViewer";
import { useCatalog } from "@/components/CatalogProvider";
import { defaultConfig, getFilament } from "@/lib/pricing";
import type { Product } from "@/lib/types";

/** Live 3D hero: cycles through the product's color presets until someone picks one. */
export function HeroViewer({ product }: { product: Product }) {
  const catalog = useCatalog();
  const [index, setIndex] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned || product.presets.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % product.presets.length), 3200);
    return () => clearInterval(t);
  }, [pinned, product.presets.length]);

  const colors = product.presets[index]?.colors ?? defaultConfig(product);

  return (
    <div className="relative">
      <div className="chunky layer-lines relative aspect-square overflow-hidden rounded-[40px] bg-sky-soft shadow-[var(--shadow-pop-lg)]">
        <ModelViewer product={product} config={colors} zoom={false} className="absolute inset-0" />
        <span className="chip pointer-events-none absolute top-4 right-4 rotate-3 bg-paper text-xs">
          Drag me ↻
        </span>
      </div>

      {product.presets.length > 0 && (
      <div className="chunky absolute -bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-paper p-1.5">
        {product.presets.map((p, i) => (
          <button
            key={p.name}
            type="button"
            onClick={() => {
              setIndex(i);
              setPinned(true);
            }}
            className={`focus-ring flex items-center gap-2 rounded-full py-1.5 pr-3 pl-2 text-sm font-bold whitespace-nowrap transition-colors ${
              i === index ? "bg-ink text-cream" : "hover:bg-cream-deep"
            }`}
            aria-pressed={i === index}
          >
            <span className="flex -space-x-1">
              {[...new Set(Object.values(p.colors))].slice(0, 3).map((id) => {
                const f = getFilament(catalog, id);
                return f && <SwatchDot key={id} filament={f} size={14} className="border-[1.5px]" />;
              })}
            </span>
            {p.name}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
