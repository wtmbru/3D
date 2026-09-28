"use client";

import { useEffect, useRef, useState } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { swatchBackground } from "@/components/Swatch";
import { finishLabels } from "@/data/constants";
import { getFilament } from "@/lib/pricing";
import type { MaterialFamily } from "@/lib/types";

/** Dropdown color picker showing real swatches (a native <select> can't). */
export function ColorSelect({
  value,
  family,
  onChange,
  label,
  compact,
}: {
  value: string;
  family: MaterialFamily;
  onChange: (filamentId: string) => void;
  label: string;
  compact?: boolean;
}) {
  const catalog = useCatalog();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = getFilament(catalog, value);
  const options = catalog.filaments.filter((f) => f.family === family);
  const finishes = [...new Set(options.map((f) => f.finish))];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.name ?? "none"}`}
        onClick={() => setOpen((o) => !o)}
        className={`focus-ring flex items-center gap-2 rounded-xl border-2 border-ink/20 bg-paper text-left transition-colors hover:border-ink ${
          compact ? "p-1" : "w-full px-2 py-1.5"
        }`}
      >
        <span
          className="h-7 w-7 shrink-0 rounded-full border-2 border-ink"
          style={current ? swatchBackground(current) : { background: "repeating-linear-gradient(45deg,#eee 0 4px,#fff 4px 8px)" }}
        />
        {!compact && (
          <span className="min-w-0 flex-1 truncate text-sm">
            {current ? (
              <>
                <span className="font-semibold">{current.name}</span>
                {current.family !== family && <span className="text-tomato"> · wrong material</span>}
                {!current.inStock && <span className="text-ink-soft"> · out of stock</span>}
              </>
            ) : (
              <span className="text-ink-soft">Pick a color</span>
            )}
          </span>
        )}
      </button>
      {open && (
        <div role="listbox" aria-label={label} className="absolute top-full left-0 z-30 mt-2 w-72 rounded-2xl border-2 border-ink bg-paper p-3 shadow-[var(--shadow-pop)]">
          {finishes.map((finish) => (
            <div key={finish} className="mb-2 last:mb-0">
              <p className="mb-1.5 text-xs font-bold tracking-wide text-ink-soft uppercase">{finishLabels[finish]}</p>
              <div className="flex flex-wrap gap-2">
                {options
                  .filter((f) => f.finish === finish)
                  .map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="option"
                      aria-selected={f.id === value}
                      title={`${f.name}${f.inStock ? "" : " (out of stock)"}`}
                      onClick={() => {
                        onChange(f.id);
                        setOpen(false);
                      }}
                      className={`focus-ring relative h-8 w-8 rounded-full border-2 border-ink transition-transform hover:scale-110 ${
                        f.id === value ? "ring-2 ring-ink ring-offset-2" : ""
                      } ${f.inStock ? "" : "opacity-40"}`}
                      style={swatchBackground(f)}
                    />
                  ))}
              </div>
            </div>
          ))}
          {options.length === 0 && <p className="text-sm text-ink-soft">No {family} filaments yet.</p>}
        </div>
      )}
    </div>
  );
}
