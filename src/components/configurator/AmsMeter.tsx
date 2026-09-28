"use client";

import { useCatalog } from "@/components/CatalogProvider";
import { getFilament, MAX_COLORS } from "@/lib/pricing";
import { swatchBackground } from "../Swatch";

/** Shows the AMS spool slots: how many of the 4 colors this design uses. */
export function AmsMeter({ used }: { used: string[] }) {
  const catalog = useCatalog();
  const full = used.length >= MAX_COLORS;
  return (
    <div className="flex items-center gap-2" title="One print can use up to 4 filament colors">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: MAX_COLORS }, (_, i) => {
          const f = used[i] ? getFilament(catalog, used[i]) : undefined;
          return (
            <span
              key={i}
              className={`h-5 w-3.5 rounded-[5px] border-2 ${f ? "border-ink" : "border-dashed border-ink/30"}`}
              style={f ? swatchBackground(f) : undefined}
            />
          );
        })}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${full ? "text-tomato" : "text-ink-soft"}`}>
        {used.length}/{MAX_COLORS} colors
      </span>
    </div>
  );
}
