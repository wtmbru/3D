"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { MAX_COLORS } from "@/lib/pricing";
import type { Imported3mf } from "@/lib/three/threemf";
import type { MaterialFamily } from "@/lib/types";
import { ColorSelect } from "./ColorSelect";
import { groupRegions, type Grouping, type ImportGroup } from "./from3mf";

export function Import3mfDialog({
  model,
  fileName,
  family,
  replacing,
  onCancel,
  onImport,
}: {
  model: Imported3mf;
  fileName: string;
  family: MaterialFamily;
  replacing: number;
  onCancel: () => void;
  onImport: (groups: ImportGroup[]) => void;
}) {
  const catalog = useCatalog();
  const ref = useRef<HTMLDialogElement>(null);
  const [grouping, setGrouping] = useState<Grouping>("color");
  // Color overrides by group key, so switching grouping keeps sensible defaults.
  const [colors, setColors] = useState<Record<string, string>>({});
  const groups = useMemo(() => groupRegions(model, grouping, catalog, family), [model, grouping, catalog, family]);
  const painted = model.regions.some((r) => r.painted);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const slotsPerPlate = model.plates.map((plate) => new Set(model.regions.filter((r) => r.plate === plate).map((r) => r.slot)).size);
  const overLimit = slotsPerPlate.some((n) => n > MAX_COLORS);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="m-auto max-h-[90vh] w-[min(640px,calc(100vw-2rem))] overflow-y-auto rounded-3xl border-2 border-ink bg-paper p-0 shadow-[var(--shadow-pop-lg)] backdrop:bg-ink/40"
    >
      <div className="space-y-5 p-6">
        <div>
          <h2 className="admin-h2">Import {fileName}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Found {new Set(model.regions.map((r) => r.sourceKey)).size} parts using {model.slots.length} filament
            {model.slots.length === 1 ? "" : "s"}
            {model.plates.length > 1 && ` on ${model.plates.length} plates`}
            {painted && ", including painted colors"}.
          </p>
        </div>

        <fieldset>
          <legend className="admin-label">What should customers be able to recolor?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["color", "Each filament color", "One choice per color in the project. Best for painted models."],
                ["part", "Each part separately", "Every part gets its own color choice, even ones that share a filament."],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-2xl border-2 p-3 ${grouping === value ? "border-ink bg-sky-soft" : "border-ink/15"}`}
              >
                <input type="radio" name="grouping" className="sr-only" checked={grouping === value} onChange={() => setGrouping(value)} />
                <span className="block font-semibold">{label}</span>
                <span className="text-xs text-ink-soft">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="admin-label">Parts to create ({groups.length})</p>
          <ul className="divide-y-2 divide-ink/10 rounded-2xl border-2 border-ink/15">
            {groups.map((g) => (
              <li key={g.key} className="flex items-center gap-3 px-3 py-2">
                <span
                  className="h-6 w-6 shrink-0 rounded-full border-2 border-ink/40"
                  style={{ background: g.slotHex }}
                  title={`Slot ${g.slot} color in the project`}
                />
                <span aria-hidden="true" className="text-ink-soft">→</span>
                <ColorSelect
                  compact
                  label={`${g.name} color`}
                  family={family}
                  value={colors[g.key] ?? g.filamentId}
                  onChange={(id) => setColors((c) => ({ ...c, [g.key]: id }))}
                />
                <span className="min-w-0 flex-1 truncate font-semibold">{g.name}</span>
                <span className="shrink-0 text-xs text-ink-soft">
                  {model.plates.length > 1 && `Print ${g.plate} · `}slot {g.slot}
                </span>
              </li>
            ))}
          </ul>
          <p className="admin-hint">
            Colors were matched to the closest {family} filament you have. You can rename parts after importing.
          </p>
        </div>

        {(model.notes.length > 0 || overLimit) && (
          <ul className="space-y-1 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
            {overLimit && <li>A plate uses more than {MAX_COLORS} filaments. Change some colors before publishing.</li>}
            {model.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {replacing > 0 && (
          <p className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold">
            This replaces the {replacing} current {replacing === 1 ? "part" : "parts"} and clears the palettes.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onImport(groups.map((g) => ({ ...g, filamentId: colors[g.key] ?? g.filamentId })))}
          >
            Import {groups.length} {groups.length === 1 ? "part" : "parts"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
