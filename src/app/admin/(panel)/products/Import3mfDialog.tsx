"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { swatchBackground } from "@/components/Swatch";
import { getFilament, MAX_COLORS } from "@/lib/pricing";
import type { Imported3mf } from "@/lib/three/threemf";
import { renderSoupPreview } from "@/lib/three/thumbnails";
import type { MaterialFamily } from "@/lib/types";
import { ColorSelect } from "./ColorSelect";
import {
  detectContents,
  groupRegions,
  subset,
  summarizeObjects,
  type Contents,
  type Grouping,
  type ImportGroup,
} from "./from3mf";

export type ImportResult =
  | { mode: "single" | "set"; groups: ImportGroup[] }
  | { mode: "options"; label: string; options: { name: string; groups: ImportGroup[] }[] };

const CONTENTS: { value: Contents; title: string; hint: string }[] = [
  { value: "single", title: "One model", hint: "Everything is one product. Customers recolor its parts." },
  { value: "options", title: "Options to choose from", hint: "Each object is a size or version. Customers pick one." },
  { value: "set", title: "A set sold together", hint: "Every object is included. Customers color each piece." },
];

export function Import3mfDialog({
  model,
  fileName,
  family,
  replacing,
  replacingOptions,
  busy,
  onCancel,
  onImport,
}: {
  model: Imported3mf;
  fileName: string;
  family: MaterialFamily;
  /** Parts in the option being edited (replaced by "One model" / "Set"). */
  replacing: number;
  /** Existing options (replaced by "Options"). */
  replacingOptions: number;
  busy?: boolean;
  onCancel: () => void;
  onImport: (result: ImportResult) => void;
}) {
  const catalog = useCatalog();
  const ref = useRef<HTMLDialogElement>(null);
  const objects = useMemo(() => summarizeObjects(model), [model]);
  const detected = useMemo(() => detectContents(model), [model]);
  const [contents, setContents] = useState<Contents>(detected.suggestion);
  const [grouping, setGrouping] = useState<Grouping>("color");
  const [colors, setColors] = useState<Record<string, string>>({});
  const [optionNames, setOptionNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(objects.map((o) => [o.key, o.name.replace(/\.stl$/i, "")])),
  );
  const [label, setLabel] = useState(() => (/\d\s*[x×]\s*\d|small|medium|large/i.test(objects.map((o) => o.name).join(" ")) ? "Size" : "Option"));
  const [fullSet, setFullSet] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const painted = model.regions.some((r) => r.painted);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // One small picture per object so it's obvious what the file holds.
  useEffect(() => {
    if (objects.length < 2) return;
    let live = true;
    (async () => {
      for (const o of objects) {
        const meshes = model.regions
          .filter((r) => r.objectKey === o.key)
          .map((r) => ({ positions: r.positions, hex: model.slots.find((s) => s.slot === r.slot)?.hex ?? "#999999" }));
        const url = await renderSoupPreview(meshes);
        if (live) setPreviews((p) => ({ ...p, [o.key]: url }));
      }
    })();
    return () => {
      live = false;
    };
  }, [model, objects]);

  const groupsFor = (m: Imported3mf, g: Grouping) =>
    groupRegions(m, g, catalog, family).map((x) => ({ ...x, filamentId: colors[x.key] ?? x.filamentId }));

  const singleGroups = useMemo(
    () => groupsFor(model, contents === "set" ? "object" : grouping),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, contents, grouping, catalog, family, colors],
  );

  const overLimit = model.plates.some(
    (plate) => new Set(model.regions.filter((r) => r.plate === plate).map((r) => r.slot)).size > MAX_COLORS,
  );

  function submit() {
    if (contents !== "options") {
      onImport({ mode: contents, groups: singleGroups });
      return;
    }
    const options = objects.map((o) => ({
      name: (optionNames[o.key] || o.name).trim().slice(0, 40),
      groups: groupsFor(subset(model, [o.key]), "color"),
    }));
    if (fullSet) options.push({ name: "Full set", groups: groupsFor(model, "object") });
    onImport({ mode: "options", label: label.trim() || "Option", options });
  }

  const partCount = contents === "options" ? objects.length + (fullSet ? 1 : 0) : singleGroups.length;
  const buttonText =
    contents === "options" ? `Create ${partCount} options` : `Import ${partCount} ${partCount === 1 ? "part" : "parts"}`;

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="m-auto max-h-[90vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto rounded-3xl border-2 border-ink bg-paper p-0 shadow-[var(--shadow-pop-lg)] backdrop:bg-ink/40"
    >
      <div className="space-y-5 p-6">
        <div>
          <h2 className="admin-h2">Import {fileName}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Found {objects.length} {objects.length === 1 ? "object" : "objects"} using {model.slots.length} filament
            {model.slots.length === 1 ? "" : "s"}
            {model.plates.length > 1 && ` on ${model.plates.length} plates`}
            {painted && ", including painted colors"}.
          </p>
        </div>

        {objects.length > 1 && (
          <>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {objects.map((o) => (
                <li key={o.key} className="rounded-2xl border-2 border-ink/15 bg-sky-soft p-1.5 text-center">
                  {previews[o.key] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[o.key]} alt="" className="aspect-square w-full object-contain" />
                  ) : (
                    <div className="aspect-square w-full animate-pulse rounded-xl bg-ink/5" />
                  )}
                  <p className="truncate text-xs font-semibold" title={o.name}>
                    {o.name}
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {Math.round(o.size[0])}×{Math.round(o.size[1])}×{Math.round(o.size[2])} mm
                  </p>
                </li>
              ))}
            </ul>

            <fieldset>
              <legend className="admin-label">What&apos;s in this file?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTENTS.map((c) => (
                  <label
                    key={c.value}
                    className={`relative cursor-pointer rounded-2xl border-2 p-3 ${contents === c.value ? "border-ink bg-sky-soft" : "border-ink/15"}`}
                  >
                    <input type="radio" name="contents" className="sr-only" checked={contents === c.value} onChange={() => setContents(c.value)} />
                    {detected.suggestion === c.value && (
                      <span className="chip absolute -top-2.5 right-2 bg-sun px-2 py-0 text-[11px]">Suggested</span>
                    )}
                    <span className="block font-semibold">{c.title}</span>
                    <span className="text-xs text-ink-soft">{c.hint}</span>
                  </label>
                ))}
              </div>
              <p className="admin-hint">
                <span aria-hidden="true">💡 </span>
                {detected.reason}
              </p>
            </fieldset>
          </>
        )}

        {contents === "single" && (
          <fieldset>
            <legend className="admin-label">What should customers be able to recolor?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["color", "Each filament color", "One choice per color in the project. Best for painted models."],
                  ["part", "Each part separately", "Every part gets its own color choice, even ones that share a filament."],
                ] as const
              ).map(([value, title, hint]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-2xl border-2 p-3 ${grouping === value ? "border-ink bg-sky-soft" : "border-ink/15"}`}
                >
                  <input type="radio" name="grouping" className="sr-only" checked={grouping === value} onChange={() => setGrouping(value)} />
                  <span className="block font-semibold">{title}</span>
                  <span className="text-xs text-ink-soft">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {contents === "options" ? (
          <div className="space-y-3">
            <label className="flex flex-wrap items-center gap-2">
              <span className="admin-label mb-0">Customers pick a</span>
              <input className="admin-input w-40 py-1.5" value={label} maxLength={24} onChange={(e) => setLabel(e.target.value)} aria-label="Option label" />
              <span className="text-xs text-ink-soft">e.g. Size, Shape, Style</span>
            </label>
            <ul className="divide-y-2 divide-ink/10 rounded-2xl border-2 border-ink/15">
              {objects.map((o) => {
                const groups = groupsFor(subset(model, [o.key]), "color");
                return (
                  <li key={o.key} className="flex items-center gap-3 px-3 py-2">
                    {previews[o.key] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[o.key]} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-sky-soft object-contain" />
                    )}
                    <input
                      className="admin-input min-w-0 flex-1 py-1.5"
                      value={optionNames[o.key] ?? ""}
                      maxLength={40}
                      aria-label={`Name for ${o.name}`}
                      onChange={(e) => setOptionNames((n) => ({ ...n, [o.key]: e.target.value }))}
                    />
                    <span className="flex shrink-0 -space-x-1">
                      {groups.map((g) => {
                        const f = getFilament(catalog, g.filamentId);
                        return f && <span key={g.key} className="h-5 w-5 rounded-full border-2 border-ink" style={swatchBackground(f)} title={`${g.name}: ${f.name}`} />;
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={fullSet} onChange={(e) => setFullSet(e.target.checked)} />
              Also add a &quot;Full set&quot; option with every piece
            </label>
            <p className="admin-hint">Colors are matched to your {family} filaments. Set a price for each option after importing.</p>
          </div>
        ) : (
          <div>
            <p className="admin-label">Parts to create ({singleGroups.length})</p>
            <ul className="divide-y-2 divide-ink/10 rounded-2xl border-2 border-ink/15">
              {singleGroups.map((g) => (
                <li key={g.key} className="flex items-center gap-3 px-3 py-2">
                  <span className="h-6 w-6 shrink-0 rounded-full border-2 border-ink/40" style={{ background: g.slotHex }} title={`Slot ${g.slot} color in the project`} />
                  <span aria-hidden="true" className="text-ink-soft">→</span>
                  <ColorSelect compact label={`${g.name} color`} family={family} value={g.filamentId} onChange={(id) => setColors((c) => ({ ...c, [g.key]: id }))} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{g.name}</span>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {model.plates.length > 1 && `Print ${g.plate} · `}slot {g.slot}
                  </span>
                </li>
              ))}
            </ul>
            <p className="admin-hint">Colors were matched to the closest {family} filament you have. You can rename parts after importing.</p>
          </div>
        )}

        {(model.notes.length > 0 || overLimit) && (
          <ul className="space-y-1 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
            {overLimit && contents !== "options" && <li>A plate uses more than {MAX_COLORS} filaments. Change some colors before publishing.</li>}
            {model.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {contents === "options" && replacingOptions > 0 && (
          <p className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold">
            This replaces the product&apos;s current {replacingOptions > 1 ? `${replacingOptions} options` : "model"} and clears the palettes.
          </p>
        )}
        {contents !== "options" && replacing > 0 && (
          <p className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold">
            This replaces the {replacing} current {replacing === 1 ? "part" : "parts"}
            {replacingOptions > 1 && " of the option you're editing"} and clears its palettes.
          </p>
        )}

        <div className="flex gap-3">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>
            {busy ? "Optimizing…" : buttonText}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
