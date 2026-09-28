"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { ModelViewer } from "@/components/viewer/ModelViewer";
import { categories, FAMILIES } from "@/data/constants";
import { remapToFamily } from "@/lib/config";
import { colorsByPlate, defaultConfig, distinctFilaments, formatPrice, MAX_COLORS, plateOf, quote } from "@/lib/pricing";
import { aliasModelFile, layoutProduct, loadProductGeometry } from "@/lib/three/models";
import type { ColorConfig, MaterialFamily, PartTransform, Product, ProductPart } from "@/lib/types";
import { import3mf, type Imported3mf } from "@/lib/three/threemf";
import { AssemblyEditor } from "./AssemblyEditor";
import { allocateBudget, PRODUCT_TRIANGLE_BUDGET, prepareModel } from "@/lib/three/meshprep";
import { measure as measureGroups, type ImportGroup } from "./from3mf";
import { Import3mfDialog } from "./Import3mfDialog";
import { deleteProduct, saveProduct } from "../../actions";
import { Notice, Switch, useNotice } from "../ui";
import { ColorSelect } from "./ColorSelect";
import { nameFromFile, readStl, slugify, uploadFile } from "./upload";

interface Upload {
  key: string;
  kind: "model" | "photo";
  name: string;
  progress: number;
  error?: string;
}

export function ProductEditor({ initial, isNew }: { initial: Product; isNew: boolean }) {
  const catalog = useCatalog();
  const router = useRouter();
  const [p, setP] = useState<Product>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [activePart, setActivePart] = useState<string | null>(null);
  const [previewPreset, setPreviewPreset] = useState<number | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [notice, setNotice] = useNotice();
  const [pending, start] = useTransition();
  const [created, setCreated] = useState(!isNew);
  const [arranging, setArranging] = useState(false);
  const [pending3mf, setPending3mf] = useState<{ model: Imported3mf; fileName: string } | null>(null);
  const [reading3mf, setReading3mf] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  // Background STL uploads per part. The preview uses the local file meanwhile.
  const [partUploads, setPartUploads] = useState<Record<string, { progress: number; error?: string }>>({});
  const localFiles = useRef(new Map<string, File>());

  const dirty = JSON.stringify(p) !== saved;
  const family = p.materials[0] ?? "PLA";
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((prev) => ({ ...prev, [k]: v }));

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const defaults = defaultConfig(p);
  const previewConfig: ColorConfig = useMemo(() => {
    const preset = previewPreset !== null ? p.presets[previewPreset] : undefined;
    return preset ? { ...defaultConfig(p), ...preset.colors } : defaultConfig(p);
  }, [p, previewPreset]);
  const plateColors = colorsByPlate(p, defaults);
  const plates = [...new Set(p.parts.map(plateOf))].sort((a, b) => a - b);
  const nextPlate = Math.max(0, ...plates) + 1;
  const price = p.parts.length ? quote(catalog, p, family, defaults) : null;

  // ── Parts ──────────────────────────────────────────────────────────────────

  function nextPartId(base: string, taken: Set<string>) {
    const clean = slugify(base).slice(0, 36) || "part";
    let id = clean;
    for (let n = 2; taken.has(id); n++) id = `${clean}-${n}`;
    taken.add(id);
    return id;
  }

  /** Suggest a different in-stock color for each new part so the preview reads clearly. */
  function suggestColor(index: number): string {
    const pool = catalog.filaments.filter((f) => f.family === family && f.inStock && f.surcharge === 0);
    return pool[(index * 3) % Math.max(pool.length, 1)]?.id ?? "";
  }

  /** Upload a part's STL in the background; swap in the public URL when done. */
  async function startPartUpload(partId: string, file: File, localUrl: string) {
    localFiles.current.set(partId, file);
    setPartUploads((u) => ({ ...u, [partId]: { progress: 0 } }));
    try {
      const url = await uploadFile(p.id, "model", file, (progress) =>
        setPartUploads((u) => ({ ...u, [partId]: { progress } })),
      );
      aliasModelFile(localUrl, url); // reuse the already-parsed model
      setP((prev) => ({
        ...prev,
        parts: prev.parts.map((x) => (x.id === partId && x.file === localUrl ? { ...x, file: url } : x)),
      }));
      setPartUploads((u) => omit(u, partId));
      localFiles.current.delete(partId);
    } catch (e) {
      const error = e instanceof Error ? e.message : "Upload failed";
      setPartUploads((u) => ({ ...u, [partId]: { progress: 0, error } }));
    }
  }

  function retryUpload(partId: string) {
    const file = localFiles.current.get(partId);
    const part = p.parts.find((x) => x.id === partId);
    if (file && part) startPartUpload(partId, file, part.file);
  }

  async function addModelFiles(files: File[]) {
    const project = files.find((f) => f.name.toLowerCase().endsWith(".3mf"));
    if (project) {
      if (files.length > 1) setNotice({ kind: "error", text: "Drop a .3mf on its own. It already contains every part." });
      setReading3mf(true);
      try {
        setPending3mf({ model: await import3mf(project), fileName: project.name });
      } catch (e) {
        setNotice({ kind: "error", text: e instanceof Error ? e.message : "That .3mf couldn't be read." });
      } finally {
        setReading3mf(false);
      }
      return;
    }
    const stls = files.filter((f) => f.name.toLowerCase().endsWith(".stl"));
    const problems: string[] = [];
    if (stls.length !== files.length) problems.push("Only .stl and .3mf files can be added.");
    const taken = new Set(p.parts.map((x) => x.id));
    let index = p.parts.length;

    const read: { file: File; positions: Float32Array }[] = [];
    for (const file of stls) {
      try {
        read.push({ file, positions: await readStl(file) });
      } catch (e) {
        problems.push(e instanceof Error ? e.message : `${file.name} couldn't be read.`);
      }
    }
    const budgets = allocateBudget(read.map((r) => r.positions.length / 9));
    setOptimizing(true);
    for (const [i, { file, positions }] of read.entries()) {
      // Simplify huge meshes and compress, then show it right away; upload in the background.
      const prepared = await prepareModel(positions, slugify(file.name.replace(/\.stl$/i, "")), budgets[i]);
      const localUrl = URL.createObjectURL(prepared.file);
      const part: ProductPart = {
        id: nextPartId(file.name.replace(/\.stl$/i, ""), taken),
        name: nameFromFile(file.name),
        file: localUrl,
        defaultFilament: suggestColor(index++),
      };
      setP((prev) => ({ ...prev, parts: [...prev.parts, part] }));
      startPartUpload(part.id, prepared.file, localUrl);
    }
    setOptimizing(false);
    if (problems.length) setNotice({ kind: "error", text: problems.join(" ") });
  }

  /** Replace all parts with the groups from a .3mf, then upload them in the background. */
  async function apply3mf(groups: ImportGroup[], title?: string) {
    setOptimizing(true);
    const taken = new Set<string>();
    const budgets = allocateBudget(groups.map((g) => g.triangles));
    const created: { part: ProductPart; file: File }[] = [];
    let before = 0;
    let after = 0;
    for (const [i, g] of groups.entries()) {
      const prepared = await prepareModel(g.positions, slugify(g.name), budgets[i]);
      before += prepared.trianglesBefore;
      after += prepared.trianglesAfter;
      created.push({
        file: prepared.file,
        part: {
          id: nextPartId(g.name, taken),
          name: g.name,
          file: URL.createObjectURL(prepared.file),
          defaultFilament: g.filamentId,
          ...(g.plate > 1 ? { plate: g.plate } : {}),
        },
      });
    }
    setOptimizing(false);
    for (const id of localFiles.current.keys()) localFiles.current.delete(id);
    setPartUploads({});
    setP((prev) => ({
      ...prev,
      ...(prev.name.trim() || !title ? {} : { name: title.slice(0, 80), ...(slugTouched ? {} : { slug: slugify(title) }) }),
      parts: created.map((c) => c.part),
      presets: [],
      upAxis: "z",
      layout: "assembled",
      dimensions: measureGroups(groups),
    }));
    setPreviewPreset(null);
    setActivePart(null);
    setPending3mf(null);
    for (const { part, file } of created) startPartUpload(part.id, file, part.file);
    const simplified =
      after < before
        ? ` Detail was reduced from ${fmtCount(before)} to ${fmtCount(after)} triangles so it loads fast (prints aren't affected).`
        : "";
    setNotice({ kind: "ok", text: `Imported ${created.length} parts.${simplified} Name them and check the colors.` });
  }

  async function replacePartFile(partId: string, file: File) {
    let positions: Float32Array;
    try {
      positions = await readStl(file);
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "That file couldn't be read." });
      return;
    }
    const budget = Math.floor(PRODUCT_TRIANGLE_BUDGET / Math.max(p.parts.length, 1));
    const prepared = await prepareModel(positions, slugify(file.name.replace(/\.stl$/i, "")), budget);
    const localUrl = URL.createObjectURL(prepared.file);
    // The new file has its own geometry, so the old placement no longer applies.
    updatePart(partId, { file: localUrl, transform: undefined });
    startPartUpload(partId, prepared.file, localUrl);
  }

  function setTransforms(transforms: Record<string, PartTransform | undefined>) {
    setP((prev) => ({
      ...prev,
      parts: prev.parts.map((x) => (x.id in transforms ? { ...x, transform: transforms[x.id] } : x)),
    }));
  }

  function updatePart(id: string, patch: Partial<ProductPart>) {
    setP((prev) => ({ ...prev, parts: prev.parts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }

  function removePart(id: string) {
    localFiles.current.delete(id);
    setPartUploads((u) => omit(u, id));
    setP((prev) => ({
      ...prev,
      parts: prev.parts.filter((x) => x.id !== id),
      presets: prev.presets.map((ps) => ({ ...ps, colors: Object.fromEntries(Object.entries(ps.colors).filter(([k]) => k !== id)) })),
    }));
  }

  function movePart(id: string, dir: -1 | 1) {
    setP((prev) => {
      const i = prev.parts.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.parts.length) return prev;
      const parts = [...prev.parts];
      [parts[i], parts[j]] = [parts[j], parts[i]];
      return { ...prev, parts };
    });
  }

  // ── Materials ──────────────────────────────────────────────────────────────

  function toggleMaterial(fam: MaterialFamily, on: boolean) {
    const next = FAMILIES.filter((f) => (f === fam ? on : p.materials.includes(f)));
    if (!next.length) return;
    // Default colors must be in the first material — remap them if it changed.
    if (next[0] !== p.materials[0]) {
      const parts = p.parts.map((x) => ({
        ...x,
        defaultFilament: remapToFamily(catalog, p, defaults, next[0])[x.id],
      }));
      const presets = p.presets.map((ps) => ({
        ...ps,
        colors: remapToFamily(catalog, p, { ...defaults, ...ps.colors }, next[0]),
      }));
      setP({ ...p, materials: next, parts, presets });
    } else {
      set("materials", next);
    }
  }

  // ── Photos ─────────────────────────────────────────────────────────────────

  async function addPhotos(files: File[]) {
    for (const file of files) {
      const key = `${file.name}-${Math.random()}`;
      setUploads((u) => [...u, { key, kind: "photo", name: file.name, progress: 0 }]);
      try {
        const url = await uploadFile(p.id, "photo", file, (progress) =>
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress } : x))),
        );
        setP((prev) => ({ ...prev, photos: [...(prev.photos ?? []), url] }));
        setUploads((u) => u.filter((x) => x.key !== key));
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: e instanceof Error ? e.message : "Upload failed" } : x)));
      }
    }
  }

  // ── Size from model ────────────────────────────────────────────────────────

  async function measure() {
    try {
      const { box } = layoutProduct(await loadProductGeometry(p), p);
      const s = box.getSize(box.min.clone());
      // Viewer space is Y-up: width = x, depth = z, height = y.
      set("dimensions", [Math.round(s.x), Math.round(s.z), Math.round(s.y)]);
    } catch {
      setNotice({ kind: "error", text: "Couldn't measure the model." });
    }
  }

  // ── Save / delete ──────────────────────────────────────────────────────────

  function save(publish?: boolean) {
    const next = publish === undefined ? p : { ...p, published: publish };
    if (publish !== undefined) setP(next);
    start(async () => {
      const res = await saveProduct(next);
      if (!res.ok) {
        setNotice({ kind: "error", text: res.error });
        return;
      }
      setSaved(JSON.stringify(next));
      setCreated(true);
      setNotice({ kind: "ok", text: next.published ? "Saved. It's live in the store." : "Saved as a draft." });
      if (isNew) router.replace(`/admin/products/${res.id}`);
    });
  }

  function remove() {
    if (!confirm(`Delete "${p.name || "this product"}" and its files? This can't be undone.`)) return;
    start(async () => {
      const res = await deleteProduct(p.id);
      if (res.ok) {
        setSaved(JSON.stringify(p)); // don't trigger the unsaved-changes warning
        router.push("/admin/products");
      } else setNotice({ kind: "error", text: res.error });
    });
  }

  const blockers = [
    !p.name.trim() && "a name",
    !p.slug && "a URL name",
    !p.parts.length && "at least one STL",
    p.parts.some((x) => !x.defaultFilament) && "a default color for every part",
    p.parts.some((x) => x.file.startsWith("blob:")) &&
      (Object.values(partUploads).some((u) => u.error) ? "failed uploads fixed (retry or remove them)" : "uploads to finish"),
  ].filter(Boolean) as string[];

  return (
    <div className="pb-28">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm font-semibold text-ink-soft hover:text-ink">
            ← Products
          </Link>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">{p.name || "New product"}</h1>
        </div>
        {created && p.published && (
          <Link href={`/product/${p.slug}`} target="_blank" className="btn btn-secondary btn-sm">
            View in store ↗
          </Link>
        )}
      </div>

      {arranging && (
        <section className="chunky mt-8 overflow-hidden rounded-[32px] bg-paper" aria-label="Arrange pieces">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-4 py-3">
            <div>
              <h2 className="admin-h2">Arrange pieces</h2>
              <p className="text-sm text-ink-soft">
                Click a piece, then drag the arrows to move it or switch to Rotate. Pieces printed flat usually
                need a 90° turn first. Everything is saved with the product.
              </p>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setArranging(false)}>
              Done arranging
            </button>
          </div>
          <div className="h-[70vh] min-h-[420px]">
            <AssemblyEditor
              product={p}
              config={previewConfig}
              selected={activePart}
              onSelect={setActivePart}
              onTransforms={setTransforms}
            />
          </div>
        </section>
      )}

      <div className="mt-8 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Preview */}
        <div className="space-y-3 md:sticky md:top-24">
          <div className="chunky layer-lines relative aspect-[4/3] overflow-hidden rounded-[32px] bg-sky-soft md:aspect-square">
            {arranging ? (
              <div className="absolute inset-0 grid place-items-center p-8 text-center text-ink-soft">
                Arranging pieces above.
              </div>
            ) : p.parts.length ? (
              <ModelViewer
                product={p}
                config={previewConfig}
                activePart={activePart}
                onPartClick={(id) => {
                  setActivePart(id);
                  document.getElementById(`part-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                autoRotate={false}
                className="absolute inset-0"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center p-8 text-center text-ink-soft">
                Upload STL files to see the 3D preview.
              </div>
            )}
          </div>
          {p.parts.length > 1 && p.layout !== "spread" && !arranging && (
            <button
              type="button"
              className="btn btn-secondary btn-sm w-full"
              onClick={() => {
                setArranging(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Arrange pieces
            </button>
          )}
          {p.presets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-sm font-semibold text-ink-soft">Preview:</span>
              <button type="button" onClick={() => setPreviewPreset(null)} className={`chip text-xs ${previewPreset === null ? "bg-ink text-cream" : ""}`}>
                Defaults
              </button>
              {p.presets.map((ps, i) => (
                <button key={i} type="button" onClick={() => setPreviewPreset(i)} className={`chip text-xs ${previewPreset === i ? "bg-ink text-cream" : ""}`}>
                  {ps.name || `Palette ${i + 1}`}
                </button>
              ))}
            </div>
          )}
          {price && (
            <div className="admin-card">
              <p className="text-sm font-semibold text-ink-soft">Customers will see</p>
              <p className="font-display text-3xl font-extrabold">from {formatPrice(price.unit)}</p>
              <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                {price.lines.map((l) => (
                  <li key={l.label} className="flex justify-between">
                    <span>{l.label}</span>
                    <span className="tabular-nums">{formatPrice(l.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="space-y-6">
          <section className="admin-card space-y-4">
            <h2 className="admin-h2">Basics</h2>
            <label className="block">
              <span className="admin-label">Name</span>
              <input
                className="admin-input"
                value={p.name}
                maxLength={80}
                placeholder="Bloop the Robot"
                onChange={(e) => {
                  const name = e.target.value;
                  setP((prev) => ({ ...prev, name, ...(slugTouched ? {} : { slug: slugify(name) }) }));
                }}
              />
            </label>
            <label className="block">
              <span className="admin-label">URL name</span>
              <div className="flex items-center rounded-xl border-2 border-ink/20 bg-cream focus-within:border-ink">
                <span className="pl-3 text-sm text-ink-soft">/product/</span>
                <input
                  className="w-full bg-transparent px-1 py-2 outline-none"
                  value={p.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", slugify(e.target.value));
                  }}
                />
              </div>
              {created && p.slug !== JSON.parse(saved).slug && (
                <span className="admin-hint text-tomato">Changing this breaks old links and shared designs.</span>
              )}
            </label>
            <label className="block">
              <span className="admin-label">Tagline</span>
              <input className="admin-input" value={p.tagline} maxLength={140} placeholder="A tiny desk buddy with big feelings." onChange={(e) => set("tagline", e.target.value)} />
            </label>
            <label className="block">
              <span className="admin-label">Description</span>
              <textarea className="admin-input min-h-28" value={p.description} maxLength={4000} onChange={(e) => set("description", e.target.value)} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="admin-label">Category</span>
                <select className="admin-input" value={p.category} onChange={(e) => set("category", e.target.value as Product["category"])}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="admin-label">Badge (optional)</span>
                <input className="admin-input" value={p.badge ?? ""} maxLength={24} placeholder="New, Bestseller…" onChange={(e) => set("badge", e.target.value || undefined)} />
              </label>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl bg-cream px-4 py-3">
              <span>
                <span className="block font-semibold">Featured</span>
                <span className="text-sm text-ink-soft">Show on the home page.</span>
              </span>
              <Switch checked={!!p.featured} onChange={(v) => set("featured", v)} label="Featured" />
            </label>
          </section>

          <section className="admin-card space-y-4">
            <h2 className="admin-h2">Price & materials</h2>
            <label className="block">
              <span className="admin-label">Base price</span>
              <div className="relative max-w-40">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">$</span>
                <input className="admin-input pl-7" type="number" min={0} step={0.5} value={p.basePrice} onChange={(e) => set("basePrice", Number(e.target.value))} />
              </div>
              <span className="admin-hint">
                Color and material extras are added automatically. Set those on the Filaments page.
              </span>
            </label>
            <fieldset>
              <legend className="admin-label">Materials customers can choose</legend>
              <div className="flex flex-wrap gap-2">
                {FAMILIES.map((fam) => {
                  const on = p.materials.includes(fam);
                  return (
                    <label key={fam} className={`chip cursor-pointer ${on ? "bg-ink text-cream" : ""}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => toggleMaterial(fam, e.target.checked)} />
                      {on ? "✓ " : ""}
                      {fam}
                    </label>
                  );
                })}
              </div>
              <span className="admin-hint">Default colors come from {family}, the first material checked.</span>
            </fieldset>
          </section>

          <section className="admin-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="admin-h2">Parts & default colors</h2>
              <span className="flex flex-wrap gap-x-3 text-sm font-semibold">
                {[...plateColors].map(([plate, ids]) => (
                  <span key={plate} className={ids.length > MAX_COLORS ? "text-tomato" : "text-ink-soft"}>
                    {plates.length > 1 && `Print ${plate}: `}
                    {ids.length}/{MAX_COLORS} colors
                  </span>
                ))}
              </span>
            </div>
            <p className="text-sm text-ink-soft">
              One STL per color region or piece, exported from Bambu Studio with the default Z-up orientation.
              Customers can recolor each part. Tap a part in the preview to find it here.
            </p>
            <p className="text-sm text-ink-soft">
              <strong className="text-ink">Printed separately?</strong> Put pieces that print at different times in
              different prints. Each print gets its own {MAX_COLORS} AMS colors.
            </p>

            {p.parts.length > 0 && (
              <ul className="space-y-2">
                {p.parts.map((part, i) => (
                  <li
                    key={part.id}
                    id={`part-${part.id}`}
                    className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-3 transition-colors ${
                      activePart === part.id ? "border-ink bg-sky-soft" : "border-ink/15"
                    }`}
                    onFocus={() => setActivePart(part.id)}
                  >
                    <div className="flex flex-col">
                      <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => movePart(part.id, -1)} className="px-1 leading-none disabled:opacity-20">
                        ▲
                      </button>
                      <button type="button" aria-label="Move down" disabled={i === p.parts.length - 1} onClick={() => movePart(part.id, 1)} className="px-1 leading-none disabled:opacity-20">
                        ▼
                      </button>
                    </div>
                    <ColorSelect compact label={`${part.name} default color`} family={family} value={part.defaultFilament} onChange={(id) => updatePart(part.id, { defaultFilament: id })} />
                    <div className="min-w-40 flex-1">
                      <input className="admin-input py-1.5" value={part.name} aria-label="Part name" maxLength={40} onChange={(e) => updatePart(part.id, { name: e.target.value })} />
                      <span className="admin-hint font-mono">id: {part.id}</span>
                    </div>
                    <select
                      className="admin-input w-auto py-1.5 text-sm"
                      aria-label={`${part.name} print`}
                      value={plateOf(part)}
                      onChange={(e) => updatePart(part.id, { plate: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })}
                    >
                      {[...new Set([...plates, nextPlate])].map((n) => (
                        <option key={n} value={n}>
                          {n === nextPlate && !plates.includes(n) ? `Print ${n} (new)` : `Print ${n}`}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm" title="Customers can't change a locked part">
                      <Switch checked={!!part.locked} onChange={(v) => updatePart(part.id, { locked: v || undefined })} label={`Lock ${part.name}`} />
                      Locked
                    </label>
                    <label className="cursor-pointer text-sm font-semibold underline decoration-2 underline-offset-4">
                      Replace
                      <input type="file" accept=".stl" className="sr-only" onChange={(e) => e.target.files?.[0] && replacePartFile(part.id, e.target.files[0])} />
                    </label>
                    <button type="button" onClick={() => removePart(part.id)} className="text-sm font-semibold text-tomato underline decoration-2 underline-offset-4">
                      Remove
                    </button>
                    {partUploads[part.id] && <PartUploadStatus status={partUploads[part.id]} onRetry={() => retryUpload(part.id)} />}
                  </li>
                ))}
              </ul>
            )}

            <DropZone
              accept=".stl,.3mf"
              label={reading3mf ? "Reading project…" : optimizing ? "Optimizing models…" : "Drop a Bambu Studio .3mf or STL files here"}
              hint="A .3mf brings in every part, its filament colors, plates and painting. STLs add one part each (up to 50 MB)."
              onFiles={addModelFiles}
            />
          </section>

          {p.parts.length > 0 && (
            <section className="admin-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="admin-h2">Quick palettes</h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => set("presets", [...p.presets, { name: `Palette ${p.presets.length + 1}`, colors: { ...defaults } }])}
                >
                  + Add palette
                </button>
              </div>
              <p className="text-sm text-ink-soft">Ready-made color combos customers can apply in one tap.</p>
              {p.presets.map((ps, i) => {
                const colors = { ...defaults, ...ps.colors };
                const count = distinctFilaments(colors).length;
                const update = (patch: Partial<typeof ps>) => set("presets", p.presets.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="rounded-2xl border-2 border-ink/15 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <input className="admin-input max-w-52 py-1.5" value={ps.name} aria-label="Palette name" maxLength={40} onChange={(e) => update({ name: e.target.value })} />
                      <span className={`text-sm font-semibold ${count > MAX_COLORS ? "text-tomato" : "text-ink-soft"}`}>
                        {count}/{MAX_COLORS} colors
                      </span>
                      <span className="flex-1" />
                      <button type="button" onClick={() => setPreviewPreset(i)} className="text-sm font-semibold underline decoration-2 underline-offset-4">
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          set("presets", p.presets.filter((_, j) => j !== i));
                          setPreviewPreset(null);
                        }}
                        className="text-sm font-semibold text-tomato underline decoration-2 underline-offset-4"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {p.parts
                        .filter((part) => !part.locked)
                        .map((part) => (
                          <div key={part.id} className="flex items-center gap-1.5 text-sm">
                            <ColorSelect
                              compact
                              label={`${ps.name}: ${part.name}`}
                              family={family}
                              value={colors[part.id]}
                              onChange={(id) => {
                                update({ colors: { ...ps.colors, [part.id]: id } });
                                setPreviewPreset(i);
                              }}
                            />
                            {part.name}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <section className="admin-card space-y-4">
            <h2 className="admin-h2">Photos</h2>
            <p className="text-sm text-ink-soft">
              Real photos of the print. The first one is used on product cards. Without photos, cards show the 3D model.
            </p>
            {(p.photos?.length ?? 0) > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {p.photos!.map((url, i) => (
                  <li key={url} className="group relative aspect-square overflow-hidden rounded-2xl border-2 border-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {i === 0 && <span className="chip absolute top-1.5 left-1.5 bg-sun px-2 py-0 text-[11px]">Cover</span>}
                    <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      {i > 0 && (
                        <button type="button" className="chip px-2 py-0 text-[11px]" onClick={() => set("photos", [url, ...p.photos!.filter((x) => x !== url)])}>
                          Make cover
                        </button>
                      )}
                      <button type="button" className="chip bg-tomato-soft px-2 py-0 text-[11px]" onClick={() => set("photos", p.photos!.filter((x) => x !== url))}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <DropZone accept=".jpg,.jpeg,.png,.webp" label="Drop photos here, or click to choose" hint="JPG, PNG or WebP." onFiles={addPhotos} />
            <UploadList uploads={uploads.filter((u) => u.kind === "photo")} onDismiss={(key) => setUploads((u) => u.filter((x) => x.key !== key))} />
          </section>

          <section className="admin-card space-y-4">
            <h2 className="admin-h2">Details</h2>
            <div>
              <span className="admin-label">Printed size (mm)</span>
              <div className="flex flex-wrap items-center gap-2">
                {(["Width", "Depth", "Height"] as const).map((label, i) => (
                  <input
                    key={label}
                    className="admin-input w-24"
                    type="number"
                    min={0}
                    aria-label={label}
                    placeholder={label}
                    value={p.dimensions[i] || ""}
                    onChange={(e) => {
                      const d = [...p.dimensions] as Product["dimensions"];
                      d[i] = Number(e.target.value);
                      set("dimensions", d);
                    }}
                  />
                ))}
                {p.parts.length > 0 && (
                  <button type="button" onClick={measure} className="text-sm font-semibold underline decoration-2 underline-offset-4">
                    Measure from model
                  </button>
                )}
              </div>
              <span className="admin-hint">W × D × H</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="admin-label">Ships in (days)</span>
                <input className="admin-input" type="number" min={0} max={90} value={p.leadTimeDays} onChange={(e) => set("leadTimeDays", Number(e.target.value))} />
              </label>
              <label className="block">
                <span className="admin-label">Model orientation</span>
                <select className="admin-input" value={p.upAxis ?? "z"} onChange={(e) => set("upAxis", e.target.value as "z" | "y")}>
                  <option value="z">Z-up (Bambu Studio, most slicers)</option>
                  <option value="y">Y-up (Blender, some downloads)</option>
                </select>
                <span className="admin-hint">Switch this if the preview is lying on its side.</span>
              </label>
              <label className="block sm:col-span-2">
                <span className="admin-label">Show pieces</span>
                <select
                  className="admin-input"
                  value={p.layout ?? "assembled"}
                  onChange={(e) => {
                    set("layout", e.target.value as Product["layout"]);
                    setArranging(false);
                  }}
                >
                  <option value="assembled">Assembled (as arranged)</option>
                  <option value="spread">Laid out side by side, like a kit</option>
                </select>
                <span className="admin-hint">Kits and sets usually look best laid out.</span>
              </label>
            </div>
          </section>

          {created && (
            <section className="rounded-3xl border-2 border-dashed border-tomato/50 p-5">
              <h2 className="font-display font-bold">Delete product</h2>
              <p className="mt-1 text-sm text-ink-soft">Removes it from the store and deletes its uploaded files.</p>
              <button type="button" onClick={remove} disabled={pending} className="btn btn-sm mt-3 bg-tomato-soft">
                Delete product
              </button>
            </section>
          )}
        </div>
      </div>

      {pending3mf && (
        <Import3mfDialog
          model={pending3mf.model}
          fileName={pending3mf.fileName}
          family={family}
          replacing={p.parts.length}
          onCancel={() => setPending3mf(null)}
          busy={optimizing}
          onImport={(groups) => apply3mf(groups, pending3mf.model.title)}
        />
      )}

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <span className={`chip text-xs ${p.published ? "bg-mint-soft" : "bg-sun-soft"}`}>{p.published ? "Live" : "Draft"}</span>
          <div className="min-w-0 flex-1 text-sm">
            {notice ? (
              <Notice notice={notice} />
            ) : blockers.length ? (
              <span className="text-ink-soft">Still needs {blockers.join(", ")}.</span>
            ) : (
              <span className="text-ink-soft">{dirty ? "Unsaved changes" : "All changes saved"}</span>
            )}
          </div>
          {p.published ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => save(false)}>
              Unpublish
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" disabled={pending || !dirty || blockers.length > 0} onClick={() => save()}>
              Save draft
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending || blockers.length > 0 || (p.published && !dirty)}
            onClick={() => save(true)}
          >
            {pending ? "Saving…" : p.published ? "Save" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DropZone({ accept, label, hint, onFiles }: { accept: string; label: string; hint: string; onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files]);
      }}
      className={`focus-ring cursor-pointer rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        over ? "border-ink bg-sky-soft" : "border-ink/30 hover:border-ink hover:bg-cream"
      }`}
    >
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const fmtCount = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`);

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _omitted, ...rest } = record; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

function PartUploadStatus({ status, onRetry }: { status: { progress: number; error?: string }; onRetry: () => void }) {
  if (status.error) {
    return (
      <div role="alert" className="w-full rounded-xl bg-tomato-soft px-3 py-2 text-sm">
        <span className="font-semibold">Upload failed:</span> {status.error}{" "}
        <button type="button" onClick={onRetry} className="font-semibold underline decoration-2 underline-offset-2">
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-ink-soft">
        <span>Uploading…</span>
        <span className="tabular-nums">{Math.round(status.progress * 100)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${status.progress * 100}%` }} />
      </div>
    </div>
  );
}

function UploadList({ uploads, onDismiss }: { uploads: Upload[]; onDismiss: (key: string) => void }) {
  if (!uploads.length) return null;
  return (
    <ul className="space-y-2">
      {uploads.map((u) => (
        <li key={u.key} className={`rounded-xl px-3 py-2 text-sm ${u.error ? "bg-tomato-soft" : "bg-cream"}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">{u.name}</span>
            {u.error ? (
              <button type="button" onClick={() => onDismiss(u.key)} className="shrink-0 font-semibold underline">
                Dismiss
              </button>
            ) : (
              <span className="tabular-nums text-ink-soft">{Math.round(u.progress * 100)}%</span>
            )}
          </div>
          {u.error ? (
            <p className="mt-0.5">{u.error}</p>
          ) : (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${u.progress * 100}%` }} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
