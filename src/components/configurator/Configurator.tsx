"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { SwatchDot } from "@/components/Swatch";
import { ModelViewer } from "@/components/viewer/ModelViewer";
import { finishLabels } from "@/data/constants";
import { MAX_QTY, useCart } from "@/lib/cart";
import { defaultsFor, designSearch, remapToFamily, type Design } from "@/lib/config";
import {
  colorsByPlate,
  defaultConfig,
  formatPrice,
  getFilament,
  MAX_COLORS,
  plateOf,
  platesOverLimit,
  quote,
} from "@/lib/pricing";
import type { AddonSelection, ColorConfig, MaterialFamily, Product } from "@/lib/types";
import { carryColors, hasOptions, resolveVariant } from "@/lib/variants";
import { AddonPicker } from "./AddonPicker";
import { AmsMeter } from "./AmsMeter";
import { OptionPicker } from "./OptionPicker";
import { Palette } from "./Palette";

interface Props {
  /** The full product, including all its options. */
  product: Product;
  initial: Design;
}

export function Configurator({ product: full, initial }: Props) {
  const catalog = useCatalog();
  const { materials } = catalog;
  const [variantId, setVariantId] = useState(initial.variantId);
  const [addons, setAddons] = useState<AddonSelection>(initial.addons);
  // Everything below works on the selected option as if it were a plain product.
  const product = useMemo(() => resolveVariant(full, variantId), [full, variantId]);
  const [family, setFamily] = useState(initial.family);
  const [config, setConfig] = useState(initial.config);
  const [activePart, setActivePart] = useState<string | null>(product.parts.find((p) => !p.locked)?.id ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const addToCart = useCart((s) => s.add);
  const partsRef = useRef<HTMLDivElement>(null);

  const price = useMemo(
    () => quote(catalog, product, family, config, addons),
    [catalog, product, family, config, addons],
  );
  const plateColors = colorsByPlate(product, config);
  const plates = [...new Set(product.parts.map(plateOf))].sort((a, b) => a - b);
  const familyInfo = materials.find((m) => m.family === family)!;

  // What the 3D model shows: the real config, plus a hover preview if any.
  const shown = useMemo(
    () => (preview && activePart ? { ...config, [activePart]: preview } : config),
    [config, preview, activePart],
  );

  // Keep the URL in sync so any design can be shared or bookmarked.
  useEffect(() => {
    const search = designSearch(full, { variantId, family, config, addons });
    window.history.replaceState(null, "", `${window.location.pathname}?${search}`);
  }, [full, variantId, family, config, addons]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 3500);
    return () => clearTimeout(t);
  }, [added]);

  /** Switch option (size, shape…), keeping the customer's colors where parts match. */
  function selectVariant(id: string) {
    const next = resolveVariant(full, id);
    const nextFamily = next.materials.includes(family) ? family : next.materials[0];
    const carried = { ...defaultConfig(next), ...carryColors(product, config, next) };
    let nextConfig = remapToFamily(catalog, next, carried, nextFamily);
    if (platesOverLimit(next, nextConfig).length) nextConfig = defaultsFor(catalog, next, nextFamily);
    setVariantId(id);
    setFamily(nextFamily);
    setConfig(nextConfig);
    setPreview(null);
    setActivePart(next.parts.find((p) => !p.locked)?.id ?? null);
  }

  function pick(partId: string, filamentId: string) {
    setConfig((c) => ({ ...c, [partId]: filamentId }));
    setPreview(null);
  }

  function changeFamily(next: MaterialFamily) {
    setFamily(next);
    setConfig((c) => remapToFamily(catalog, product, c, next));
  }

  function applyPreset(colors: ColorConfig) {
    const merged = { ...config };
    for (const part of product.parts) if (!part.locked && colors[part.id]) merged[part.id] = colors[part.id];
    setConfig(remapToFamily(catalog, product, merged, family));
  }

  function surpriseMe() {
    const pool = catalog.filaments.filter((f) => f.family === family && f.inStock);
    const next = { ...config };
    // Each print gets its own random palette of up to 4 colors.
    for (const plate of plates) {
      const parts = product.parts.filter((p) => plateOf(p) === plate);
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const locked = parts.filter((p) => p.locked).map((p) => config[p.id]);
      const palette = [...new Set([...locked, ...shuffled.map((f) => f.id)])].slice(0, MAX_COLORS);
      const free = palette.filter((id) => !locked.includes(id));
      parts.forEach((p, i) => {
        if (!p.locked && free.length) next[p.id] = free[i % free.length];
      });
    }
    setConfig(next);
  }

  function selectPartFromModel(partId: string) {
    setActivePart(partId);
    // On phones the list is below the model; bring the palette into view.
    if (window.matchMedia("(max-width: 767px)").matches) {
      partsRef.current
        ?.querySelector(`[data-part="${partId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the URL bar already has the link.
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1.15fr_1fr] md:gap-10">
      {/* 3D stage */}
      {/* On phones the stage sticks under the header so colors can be seen while picking. */}
      <div className="max-md:contents md:sticky md:top-24 md:self-start">
        <div className="chunky layer-lines relative overflow-hidden rounded-[36px] bg-sky-soft shadow-[var(--shadow-pop-lg)] max-md:sticky max-md:top-[76px] max-md:z-20 max-md:h-[42svh] md:aspect-square">
          <ModelViewer
            key={variantId}
            product={product}
            config={shown}
            activePart={activePart}
            onPartClick={selectPartFromModel}
            className="absolute inset-0"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
            <span className="chip bg-paper/95 text-xs">
              <span aria-hidden="true">👆</span> Tap a part to paint it
            </span>
            {product.badge && <span className="chip rotate-3 bg-sun text-xs">{product.badge}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft md:mt-4">
          <span>Drag to spin · scroll or pinch to zoom</span>
          <button type="button" onClick={share} className="btn btn-secondary btn-sm">
            {copied ? "Link copied!" : "Share this design"}
          </button>
        </div>
        {(product.photos?.length ?? 0) > 0 && (
          <div className="md:mt-5">
            <p className="eyebrow mb-2">Real prints</p>
            <div className="grid grid-cols-4 gap-2">
              {product.photos!.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring overflow-hidden rounded-2xl border-2 border-ink"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${product.name} photo ${i + 1}`}
                    className="aspect-square w-full object-cover transition-transform hover:scale-105"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Options */}
      <div>
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">{product.name}</h1>
        <p className="mt-3 text-lg text-ink-soft">{product.tagline}</p>

        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-display text-4xl font-extrabold tabular-nums">{formatPrice(price.unit)}</span>
          <span className="text-ink-soft">each</span>
        </div>

        {hasOptions(full) && (
          <OptionPicker product={full} selected={variantId} onSelect={selectVariant} />
        )}

        {/* Material */}
        {product.materials.length > 1 && (
          <fieldset className="mt-8">
            <legend className="eyebrow">Material</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.materials.map((fam) => {
                const m = materials.find((x) => x.family === fam)!;
                const on = fam === family;
                return (
                  <button
                    key={fam}
                    type="button"
                    aria-pressed={on}
                    onClick={() => changeFamily(fam)}
                    className={`chip focus-ring px-4 py-2 text-[15px] transition-transform hover:-translate-y-0.5 ${
                      on ? "bg-ink text-cream" : "bg-paper"
                    }`}
                  >
                    {m.label}
                    {m.surcharge > 0 && (
                      <span className={on ? "text-cream/70" : "text-ink-soft"}>+{formatPrice(m.surcharge)}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-ink-soft">{familyInfo.blurb}</p>
          </fieldset>
        )}

        {/* Presets */}
        <div className="mt-8">
          <p className="eyebrow">Quick palettes</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.presets.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p.colors)}
                className="chip focus-ring bg-paper transition-transform hover:-translate-y-0.5"
              >
                <span className="flex -space-x-1">
                  {[...new Set(Object.values(remapToFamily(catalog, product, p.colors, family)))].map((id) => {
                    const f = getFilament(catalog, id);
                    return f && <SwatchDot key={id} filament={f} size={14} className="border-[1.5px]" />;
                  })}
                </span>
                {p.name}
              </button>
            ))}
            <button
              type="button"
              onClick={surpriseMe}
              className="chip focus-ring bg-sun transition-transform hover:-translate-y-0.5 hover:rotate-2"
            >
              <span aria-hidden="true">🎲</span> Surprise me
            </button>
          </div>
        </div>

        {/* Parts */}
        <div className="mt-8" ref={partsRef}>
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Colors</p>
            {plates.length === 1 && <AmsMeter used={plateColors.get(plates[0]) ?? []} />}
          </div>
          {plates.length > 1 && (
            <p className="mt-1 text-sm text-ink-soft">
              Printed as {plates.length} separate pieces, and each one can use up to {MAX_COLORS} colors.
            </p>
          )}
          {plates.map((plate, plateIndex) => (
            <div key={plate}>
              {plates.length > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">Print {plateIndex + 1}</p>
                  <AmsMeter used={plateColors.get(plate) ?? []} />
                </div>
              )}
              <ul className="mt-3 space-y-3">
                {product.parts
                  .filter((part) => plateOf(part) === plate)
                  .map((part) => {
                    const f = getFilament(catalog, config[part.id]);
                    const open = activePart === part.id && !part.locked;
                    return (
                      <li
                        key={part.id}
                        data-part={part.id}
                        className={`scroll-mt-[calc(42svh+96px)] overflow-hidden rounded-3xl md:scroll-mt-24 border-2 border-ink bg-paper transition-shadow ${
                          open ? "shadow-[var(--shadow-pop)]" : ""
                        }`}
                      >
                        <button
                          type="button"
                          disabled={part.locked}
                          aria-expanded={part.locked ? undefined : open}
                          onClick={() => setActivePart(open ? null : part.id)}
                          className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                        >
                          {f && <SwatchDot filament={f} size={30} />}
                          <span className="min-w-0 flex-1">
                            <span className="block font-display font-bold">{part.name}</span>
                            <span className="block truncate text-sm text-ink-soft">
                              {f ? `${f.name} · ${finishLabels[f.finish]}` : "Choose a color"}
                            </span>
                          </span>
                          {part.locked ? (
                            <span className="chip bg-cream text-xs">Fixed</span>
                          ) : (
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className={`transition-transform ${open ? "rotate-180" : ""}`}
                            >
                              <path
                                d="M6 9l6 6 6-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                        {open && (
                          <div className="border-t-2 border-dashed border-ink/20 px-4 pt-3 pb-4">
                            <Palette
                              family={family}
                              partId={part.id}
                              config={Object.fromEntries(
                                product.parts.filter((x) => plateOf(x) === plate).map((x) => [x.id, config[x.id]]),
                              )}
                              onPick={(id) => pick(part.id, id)}
                              onPreview={setPreview}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>

        {(full.addons?.length ?? 0) > 0 && (
          <AddonPicker product={full} selected={addons} onChange={setAddons} />
        )}

        {/* Buy */}
        <div className="mt-8 flex flex-wrap items-stretch gap-3">
          <div className="chunky flex items-center rounded-full bg-paper">
            <button
              type="button"
              className="focus-ring h-full rounded-l-full px-4 text-xl font-bold disabled:opacity-40"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-8 text-center font-display text-lg font-bold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              className="focus-ring h-full rounded-r-full px-4 text-xl font-bold disabled:opacity-40"
              onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
              disabled={qty >= MAX_QTY}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary flex-1 text-lg"
            onClick={() => {
              addToCart({
                slug: full.slug,
                ...(hasOptions(full) ? { variant: variantId } : {}),
                family,
                config,
                ...(full.addons?.length ? { addons } : {}),
                qty,
              });
              setAdded(true);
            }}
          >
            Add to cart · {formatPrice(price.unit * qty)}
          </button>
        </div>
        <div aria-live="polite">
          {added && (
            <div className="chunky mt-4 flex items-center justify-between gap-3 rounded-2xl bg-mint-soft px-4 py-3">
              <span className="font-semibold">
                <span aria-hidden="true">🎉 </span>Added to your cart!
              </span>
              <Link href="/cart" className="font-display font-bold underline decoration-2 underline-offset-4">
                View cart →
              </Link>
            </div>
          )}
        </div>

        <details className="group mt-6 rounded-2xl border-2 border-ink/15 px-4 py-3">
          <summary className="cursor-pointer list-none font-semibold marker:hidden">
            <span className="flex items-center justify-between">
              How this price adds up
              <span className="transition-transform group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </span>
          </summary>
          <dl className="mt-3 space-y-1.5 text-sm">
            {price.lines.map((l) => (
              <div key={l.label} className="flex justify-between">
                <dt className="text-ink-soft">{l.label}</dt>
                <dd className="tabular-nums">{formatPrice(l.amount)}</dd>
              </div>
            ))}
          </dl>
        </details>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <Spec label="Size" value={`${cm(product.dimensions[0])} × ${cm(product.dimensions[2])} cm`} />
          <Spec label="Ships in" value={`${product.leadTimeDays}–${product.leadTimeDays + 2} days`} />
          <Spec label="Material" value={family} />
        </div>

        <p className="mt-8 leading-relaxed text-ink-soft">{product.description}</p>
      </div>
    </div>
  );
}

const cm = (mm: number) => Math.round(mm / 1) / 10;

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream-deep px-2 py-3">
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="font-display font-bold">{value}</p>
    </div>
  );
}
