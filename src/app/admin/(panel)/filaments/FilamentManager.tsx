"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { swatchBackground } from "@/components/Swatch";
import { FAMILIES, FINISHES, finishLabels } from "@/data/constants";
import { formatPrice } from "@/lib/pricing";
import type { Filament, MaterialFamily, MaterialInfo } from "@/lib/types";
import { deleteFilament, saveFilament, saveMaterial, setFilamentStock } from "../../actions";
import { Notice, Switch, useNotice } from "../ui";

type Draft = Omit<Filament, "id"> & { id?: string };

const blank = (family: MaterialFamily): Draft => ({
  name: "",
  family,
  finish: "basic",
  hex: "#FF7A1A",
  inStock: true,
  surcharge: 0,
});

export function FilamentManager() {
  const { filaments, materials } = useCatalog();
  const [family, setFamily] = useState<MaterialFamily>("PLA");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [notice, setNotice] = useNotice();

  const list = filaments.filter((f) => f.family === family);

  return (
    <div className="mt-8 space-y-10">
      <section aria-labelledby="materials-h">
        <h2 id="materials-h" className="admin-h2">
          Materials
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Extra charge per item when a customer picks this material.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {materials.map((m) => (
            <MaterialCard key={m.family} material={m} />
          ))}
        </div>
      </section>

      <section aria-labelledby="filaments-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="filaments-h" className="admin-h2">
            Colors
          </h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(blank(family))}>
            + Add filament
          </button>
        </div>

        <div className="mt-4 flex gap-2" role="tablist" aria-label="Material">
          {FAMILIES.map((fam) => (
            <button
              key={fam}
              type="button"
              role="tab"
              aria-selected={fam === family}
              onClick={() => setFamily(fam)}
              className={`chip focus-ring ${fam === family ? "bg-ink text-cream" : ""}`}
            >
              {fam}
              <span className={fam === family ? "text-cream/60" : "text-ink-soft"}>
                {filaments.filter((f) => f.family === fam).length}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <Notice notice={notice} />
        </div>

        <ul className="mt-4 divide-y-2 divide-ink/10 overflow-hidden rounded-3xl border-2 border-ink bg-paper">
          {list.map((f) => (
            <FilamentRow
              key={f.id}
              filament={f}
              onEdit={() => setEditing(f)}
              onError={(text) => setNotice({ kind: "error", text })}
            />
          ))}
          {list.length === 0 && <li className="p-6 text-center text-ink-soft">No {family} filaments yet.</li>}
        </ul>
      </section>

      {editing && (
        <FilamentDialog
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ kind: "ok", text });
          }}
        />
      )}
    </div>
  );
}

function FilamentRow({ filament: f, onEdit, onError }: { filament: Filament; onEdit: () => void; onError: (t: string) => void }) {
  const [pending, start] = useTransition();
  // Flips instantly; reverts on its own if the save fails.
  const [inStock, setInStock] = useOptimistic(f.inStock);

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <span className="h-10 w-10 shrink-0 rounded-full border-2 border-ink" style={swatchBackground(f)} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-bold">{f.name}</p>
        <p className="truncate text-sm text-ink-soft">
          {finishLabels[f.finish]}
          {f.brand && ` · ${f.brand}`}
          {f.surcharge > 0 && ` · +${formatPrice(f.surcharge)}`}
          <span className="ml-2 font-mono text-xs text-ink-faint">{f.hex}</span>
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <span className={`hidden sm:inline ${inStock ? "" : "text-ink-soft"}`}>{inStock ? "In stock" : "Out"}</span>
        <Switch
          checked={inStock}
          label={`${f.name} in stock`}
          disabled={pending}
          onChange={(v) =>
            start(async () => {
              setInStock(v);
              const res = await setFilamentStock(f.id, v);
              if (!res.ok) onError(res.error);
            })
          }
        />
      </label>
      <button type="button" onClick={onEdit} className="btn btn-secondary btn-sm">
        Edit
      </button>
    </li>
  );
}

function FilamentDialog({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: (t: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState<Draft>(draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isNew = !draft.id;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function save() {
    setError(null);
    start(async () => {
      const res = await saveFilament({ ...f, hex2: f.hex2 ?? "", brand: f.brand || undefined });
      if (res.ok) onSaved(`${f.name} saved.`);
      else setError(res.error);
    });
  }

  function remove() {
    if (!draft.id || !confirm(`Delete ${draft.name}? This can't be undone.`)) return;
    start(async () => {
      const res = await deleteFilament(draft.id!);
      if (res.ok) onSaved(`${draft.name} deleted.`);
      else setError(res.error);
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-3xl border-2 border-ink bg-paper p-0 shadow-[var(--shadow-pop-lg)] backdrop:bg-ink/40"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4 p-6"
      >
        <div className="flex items-center gap-4">
          <span className="h-16 w-16 shrink-0 rounded-2xl border-2 border-ink" style={swatchBackground({ ...f, id: "preview" })} />
          <div>
            <h2 className="admin-h2">{isNew ? "Add a filament" : `Edit ${draft.name}`}</h2>
            {!isNew && <p className="font-mono text-xs text-ink-soft">id: {draft.id}</p>}
          </div>
        </div>

        <label className="block">
          <span className="admin-label">Color name</span>
          <input className="admin-input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Sunflower Yellow" required maxLength={60} autoFocus />
          <span className="admin-hint">This is what customers see.</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="admin-label">Material</span>
            <select className="admin-input" value={f.family} onChange={(e) => set("family", e.target.value as MaterialFamily)} disabled={!isNew}>
              {FAMILIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            {!isNew && <span className="admin-hint">Can&apos;t change after creating.</span>}
          </label>
          <label className="block">
            <span className="admin-label">Finish</span>
            <select className="admin-input" value={f.finish} onChange={(e) => set("finish", e.target.value as Draft["finish"])}>
              {FINISHES.map((x) => (
                <option key={x} value={x}>
                  {finishLabels[x]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={`grid gap-4 ${f.finish === "silk" ? "grid-cols-2" : "grid-cols-1"}`}>
          <ColorField label="Color" value={f.hex} onChange={(v) => set("hex", v)} />
          {f.finish === "silk" && (
            <ColorField label="Shimmer color" value={f.hex2 ?? f.hex} onChange={(v) => set("hex2", v)} hint="The lighter shine silk shows." />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="admin-label">Extra charge</span>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">$</span>
              <input className="admin-input pl-7" type="number" min={0} step={0.5} value={f.surcharge} onChange={(e) => set("surcharge", Number(e.target.value))} />
            </div>
            <span className="admin-hint">Added once per item using it.</span>
          </label>
          <label className="block">
            <span className="admin-label">Brand (optional)</span>
            <input className="admin-input" value={f.brand ?? ""} onChange={(e) => set("brand", e.target.value)} placeholder="Bambu Lab" maxLength={60} />
          </label>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-2xl bg-cream px-4 py-3">
          <span className="font-semibold">In stock</span>
          <Switch checked={f.inStock} onChange={(v) => set("inStock", v)} label="In stock" />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-tomato-soft px-3 py-2 text-sm font-semibold">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "Saving…" : isNew ? "Add filament" : "Save"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <span className="flex-1" />
          {!isNew && (
            <button type="button" onClick={remove} disabled={pending} className="text-sm font-semibold text-tomato underline decoration-2 underline-offset-4">
              Delete
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  // What's typed while editing; falls back to the real value otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <span className="admin-label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border-2 border-ink/20 bg-paper p-0.5"
        />
        <input
          className="admin-input font-mono uppercase"
          aria-label={`${label} hex code`}
          value={draft ?? value}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setDraft(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toUpperCase());
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
      {hint && <span className="admin-hint">{hint}</span>}
    </div>
  );
}

function MaterialCard({ material }: { material: MaterialInfo }) {
  const [m, setM] = useState(material);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useNotice();
  const dirty = m.surcharge !== material.surcharge || m.blurb !== material.blurb || m.label !== material.label;

  return (
    <form
      className="admin-card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveMaterial(m);
          setNotice(res.ok ? { kind: "ok", text: "Saved." } : { kind: "error", text: res.error });
        });
      }}
    >
      <input className="admin-input font-display font-bold" value={m.label} onChange={(e) => setM({ ...m, label: e.target.value })} aria-label={`${material.family} display name`} />
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Extra charge</span>
        <span className="relative w-28">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">+$</span>
          <input
            className="admin-input pl-8"
            type="number"
            min={0}
            step={0.5}
            value={m.surcharge}
            onChange={(e) => setM({ ...m, surcharge: Number(e.target.value) })}
          />
        </span>
      </label>
      <textarea className="admin-input min-h-20 text-sm" value={m.blurb} onChange={(e) => setM({ ...m, blurb: e.target.value })} aria-label={`${material.family} description`} maxLength={200} />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-secondary btn-sm" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <Notice notice={notice} />
      </div>
    </form>
  );
}
