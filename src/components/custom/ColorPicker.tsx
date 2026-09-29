"use client";

import { useState } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { swatchBackground } from "@/components/Swatch";
import { FAMILIES, FINISHES, MAX_REQUEST_COLORS, finishLabels } from "@/data/constants";
import type { MaterialFamily } from "@/lib/types";

/** Pick colors from what's actually in stock. Selection is a list of filament ids. */
export function ColorPicker({ value, onChange }: { value: string[]; onChange: React.Dispatch<React.SetStateAction<string[]>> }) {
  const { filaments } = useCatalog();
  const available = filaments.filter((f) => f.inStock);
  const families = FAMILIES.filter((fam) => available.some((f) => f.family === fam));
  const [tab, setTab] = useState<MaterialFamily | null>(null);
  const family = tab && families.includes(tab) ? tab : families[0];
  const full = value.length >= MAX_REQUEST_COLORS;

  if (available.length === 0) return null;

  const toggle = (id: string) =>
    onChange((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_REQUEST_COLORS ? cur : [...cur, id]));
  const picked = value.map((id) => filaments.find((f) => f.id === id)).filter((f) => !!f);

  return (
    <div className="mt-4">
      <span className="admin-label">
        Colors we have right now <span className="font-semibold text-ink-soft">(optional, up to {MAX_REQUEST_COLORS})</span>
      </span>

      <div role="tablist" aria-label="Material" className="mt-2 flex flex-wrap gap-2">
        {families.map((fam) => (
          <button
            key={fam}
            type="button"
            role="tab"
            aria-selected={fam === family}
            onClick={() => setTab(fam)}
            className={`chip focus-ring ${fam === family ? "bg-ink text-cream" : "bg-paper"}`}
          >
            {fam}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-4">
        {FINISHES.map((finish) => {
          const group = available.filter((f) => f.family === family && f.finish === finish);
          if (group.length === 0) return null;
          return (
            <div key={finish}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{finishLabels[finish]}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {group.map((f) => {
                  const on = value.includes(f.id);
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => toggle(f.id)}
                        aria-pressed={on}
                        disabled={!on && full}
                        title={f.name}
                        aria-label={f.name}
                        className={`focus-ring relative grid h-11 w-11 place-items-center rounded-full border-2 transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40 ${
                          on ? "border-ink shadow-[var(--shadow-pop-sm)]" : "border-ink/30"
                        }`}
                        style={swatchBackground(f)}
                      >
                        {on && <span className="rounded-full bg-ink px-1.5 text-xs font-extrabold text-cream">✓</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {picked.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Your colors">
          {picked.map((f) => (
            <li key={f.id} className="chip flex items-center gap-2 bg-cream-deep">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-ink" style={swatchBackground(f)} />
              {f.name} <span className="text-ink-soft">{f.family}</span>
              <button type="button" onClick={() => toggle(f.id)} className="focus-ring rounded-full px-1 font-extrabold" aria-label={`Remove ${f.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-hint">Tap the colors you like. You can also just describe them below.</p>
      )}
      {full && <p className="admin-hint">That&apos;s the most colors we can put in one print.</p>}
    </div>
  );
}
