"use client";

import { useState } from "react";
import { swatchBackground } from "@/components/Swatch";
import { useCatalog } from "@/components/CatalogProvider";
import { finishLabels } from "@/data/constants";
import { distinctFilaments, formatPrice, getFilament, MAX_COLORS } from "@/lib/pricing";
import type { ColorConfig, Filament, MaterialFamily } from "@/lib/types";

interface Props {
  family: MaterialFamily;
  partId: string;
  /** Colors of the parts printed together with this one (the limit is per print). */
  config: ColorConfig;
  onPick: (filamentId: string) => void;
  onPreview: (filamentId: string | null) => void;
}

export function Palette({ family, partId, config, onPick, onPreview }: Props) {
  const catalog = useCatalog();
  const [hover, setHover] = useState<Filament | null>(null);
  const options = catalog.filaments.filter((f) => f.family === family);
  const finishes = [...new Set(options.map((f) => f.finish))];
  const selected = getFilament(catalog, config[partId]);

  // A color is blocked if picking it would push the print past 4 filaments.
  const wouldExceed = (id: string) => distinctFilaments({ ...config, [partId]: id }).length > MAX_COLORS;
  const anyBlocked = options.some((f) => f.inStock && wouldExceed(f.id));

  const label = hover ?? selected;

  return (
    <div onMouseLeave={() => { setHover(null); onPreview(null); }}>
      {finishes.map((finish) => {
        const group = options.filter((f) => f.finish === finish);
        const surcharge = Math.max(...group.map((f) => f.surcharge));
        return (
          <div key={finish} className="mt-2 first:mt-0">
            <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
              {finishLabels[finish]}
              {surcharge > 0 && <span className="ml-1.5 font-semibold normal-case">+{formatPrice(surcharge)}</span>}
            </p>
            <div className="flex flex-wrap gap-2.5 pb-2" role="radiogroup" aria-label={`${finishLabels[finish]} colors`}>
              {group.map((f) => {
                const isSelected = f.id === config[partId];
                const blocked = !isSelected && wouldExceed(f.id);
                const disabled = !f.inStock || blocked;
                const reason = !f.inStock ? "Out of stock" : blocked ? `Max ${MAX_COLORS} colors per print` : "";
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${f.name}${reason ? ` (${reason})` : ""}`}
                    title={reason ? `${f.name} · ${reason}` : f.name}
                    disabled={disabled}
                    onClick={() => onPick(f.id)}
                    onMouseEnter={() => {
                      setHover(f);
                      if (!disabled) onPreview(f.id);
                    }}
                    onFocus={() => setHover(f)}
                    className={`focus-ring relative h-10 w-10 rounded-full border-2 border-ink transition-transform ${
                      isSelected ? "scale-110 ring-[3px] ring-ink ring-offset-2 ring-offset-paper" : "hover:scale-110"
                    } ${disabled ? "cursor-not-allowed opacity-35 hover:scale-100" : ""}`}
                    style={swatchBackground(f)}
                  >
                    {!f.inStock && (
                      <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
                        <span className="h-[2px] w-[130%] rotate-45 bg-ink" />
                      </span>
                    )}
                    {isSelected && (
                      <svg className="absolute inset-0 m-auto drop-shadow" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={isLight(f.hex) ? "#1f1640" : "#fff"} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="mt-1 min-h-5 text-sm">
        {label && (
          <>
            <span className="font-semibold">{label.name}</span>
            <span className="text-ink-soft">
              {" "}· {label.family} {finishLabels[label.finish]}
              {!label.inStock && " · out of stock"}
            </span>
          </>
        )}
      </p>
      {anyBlocked && (
        <p className="mt-1 text-sm text-ink-soft">
          This print already uses {MAX_COLORS} colors, the most one print can have. Reuse one of them,
          or change another part first.
        </p>
      )}
    </div>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
