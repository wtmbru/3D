"use client";

import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { estimatePrint, type CostSettings } from "@/lib/costs";
import { defaultConfig, formatPrice, quote } from "@/lib/pricing";
import { loadProductGeometry } from "@/lib/three/models";
import { totalVolume } from "@/lib/three/volume";
import type { MaterialFamily, Product } from "@/lib/types";
import { variantFields, variantsOf } from "@/lib/variants";

/**
 * A private estimate of each option's weight and plastic cost, next to what it sells for.
 * Worked out from the model's volume, so it's a guide (within roughly 20–30%), not the
 * slicer's number. It leaves out her time, power and printer wear.
 */
export function WeightCostCard({ product, costs }: { product: Product; costs: CostSettings }) {
  const catalog = useCatalog();
  const variants = useMemo(() => variantsOf(product), [product]);
  // Only reload the models when the actual files change, not on every edit.
  const filesKey = `${product.upAxis ?? "z"}|${variants.map((v) => `${v.id}:${v.parts.map((p) => p.file).join(",")}`).join("|")}`;
  const [volumes, setVolumes] = useState<Record<string, number> | "error" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          variants.map(async (v) => {
            if (v.parts.length === 0) return [v.id, 0] as const;
            const geo = await loadProductGeometry({ parts: v.parts, upAxis: product.upAxis });
            return [v.id, totalVolume(Object.values(geo.parts))] as const;
          }),
        );
        if (!cancelled) setVolumes(Object.fromEntries(entries));
      } catch {
        if (!cancelled) setVolumes("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filesKey stands in for the files
  }, [filesKey]);

  if (variants.every((v) => v.parts.length === 0)) return null;

  return (
    <section className="admin-card space-y-3" aria-label="Weight and cost">
      <div>
        <h2 className="admin-h2">Weight & cost (private)</h2>
        <p className="mt-1 text-sm text-ink-soft">Only you see this. An estimate from the model&apos;s size.</p>
      </div>
      {volumes === null && <p className="text-sm text-ink-soft">Measuring…</p>}
      {volumes === "error" && <p className="text-sm font-semibold text-tomato">Couldn&apos;t read the model to measure it.</p>}
      {volumes && volumes !== "error" && (
        <ul className="space-y-4">
          {variants.map((v) => {
            const volume = volumes[v.id] ?? 0;
            const option = { ...product, ...variantFields(v) };
            return (
              <li key={v.id}>
                {variants.length > 1 && <p className="font-display font-bold">{v.name || "Option"}</p>}
                {volume < 1 ? (
                  <p className="text-sm text-ink-soft">Add a model to see an estimate.</p>
                ) : (
                  <table className="mt-1 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold tracking-wide text-ink-soft uppercase">
                        <th className="py-1 pr-2">Material</th>
                        <th className="py-1 pr-2">Weight</th>
                        <th className="py-1 pr-2">Plastic</th>
                        <th className="py-1 pr-2">Sells for</th>
                        <th className="py-1">Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.materials.map((fam: MaterialFamily) => {
                        const { grams, cost } = estimatePrint(volume, fam, costs);
                        const sells = quote(catalog, option, fam, defaultConfig(option)).unit;
                        return (
                          <tr key={fam} className="border-t border-ink/10">
                            <td className="py-1.5 pr-2 font-semibold">{fam}</td>
                            <td className="py-1.5 pr-2 tabular-nums">≈ {Math.round(grams)} g</td>
                            <td className="py-1.5 pr-2 tabular-nums">{formatPrice(Math.round(cost * 100) / 100)}</td>
                            <td className="py-1.5 pr-2 tabular-nums">{formatPrice(sells)}</td>
                            <td className="py-1.5 font-semibold tabular-nums">{formatPrice(Math.round((sells - cost) * 100) / 100)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="admin-hint">
        &quot;Left&quot; is the selling price minus the plastic only, before your time, power and printer wear. Adjust the assumptions in Settings → Cost estimates.
      </p>
    </section>
  );
}
