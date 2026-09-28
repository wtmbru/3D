/**
 * Bambu Studio / OrcaSlicer / PrusaSlicer .3mf import (browser only).
 *
 * Turns a slicer project into recolorable parts:
 *   - every object/part, placed exactly as on the build plate
 *   - the filament slot ("extruder") each part uses
 *   - painted colors (the paint tool), decoded triangle by triangle
 *   - which plate each object is on
 *   - the project's filament colors
 *
 * Format notes (verified against BambuStudio's bbs_3mf.cpp / TriangleSelector.cpp):
 *   - 3D/3dmodel.model: root objects are either meshes, or <components> that
 *     point at meshes (often in 3D/Objects/*.model via p:path). World position
 *     = build item transform ∘ component transform ∘ vertex.
 *   - Metadata/model_settings.config: <object id> (root object id) with
 *     <part id> (= component objectid) and "extruder"/"name" metadata; older
 *     files use firstid/lastid triangle ranges instead. <plate> lists which
 *     object ids sit on which plate.
 *   - Metadata/project_settings.config (JSON): filament_colour / filament_type.
 *   - Paint: per-triangle `paint_color` (Bambu) or `slic3rpe:mmu_segmentation`
 *     (Prusa) hex string, a depth-first subdivision tree. See decodePaint().
 */
import { strFromU8, unzipSync } from "fflate";

export interface ImportedRegion {
  /** Source object + part names, for labelling. */
  objectName: string;
  partName: string;
  /** Unique id of the source part (object/part), for "each part separately" grouping. */
  sourceKey: string;
  plate: number;
  /** 1-based filament slot. */
  slot: number;
  /** True if these triangles got their color from painting rather than the part's slot. */
  painted: boolean;
  /** Flat xyz triangle soup in millimetres, Z-up (slicer coordinates). */
  positions: Float32Array;
}

export interface ImportedSlot {
  slot: number;
  hex: string;
  type?: string;
  name?: string;
}

export interface Imported3mf {
  title?: string;
  regions: ImportedRegion[];
  slots: ImportedSlot[];
  plates: number[];
  notes: string[];
}

type Mat = number[]; // 3MF affine transform: 12 values, row-vector convention

const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parseTransform(s: string | null): Mat {
  if (!s) return IDENTITY;
  const v = s.trim().split(/\s+/).map(Number);
  return v.length === 12 && v.every(Number.isFinite) ? v : IDENTITY;
}

/** a then b (apply a first). */
function compose(a: Mat, b: Mat): Mat {
  const r: Mat = new Array(12).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = row === 3 ? b[9 + col] : 0;
      for (let k = 0; k < 3; k++) sum += a[row * 3 + k] * b[k * 3 + col];
      r[row * 3 + col] = sum;
    }
  }
  return r;
}

function apply(m: Mat, x: number, y: number, z: number, out: number[], o: number) {
  out[o] = x * m[0] + y * m[3] + z * m[6] + m[9];
  out[o + 1] = x * m[1] + y * m[4] + z * m[7] + m[10];
  out[o + 2] = x * m[2] + y * m[5] + z * m[8] + m[11];
}

// ── Paint decoding ───────────────────────────────────────────────────────────

type V3 = [number, number, number];
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/** Children of a split triangle, in TriangleSelector::perform_split order. */
function splitTriangle(v: [V3, V3, V3], sides: number, special: number): [V3, V3, V3][] {
  const r0 = v[special % 3];
  const r1 = v[(special + 1) % 3];
  const r2 = v[(special + 2) % 3];
  if (sides === 1) {
    const m = mid(r2, r1);
    return [
      [r0, r1, m],
      [m, r2, r0],
    ];
  }
  if (sides === 2) {
    const mab = mid(r1, r0);
    const mac = mid(r0, r2);
    return [
      [r0, mab, mac],
      [mab, r1, mac],
      [r1, r2, mac],
    ];
  }
  const mab = mid(r1, r0);
  const mbc = mid(r2, r1);
  const mca = mid(r0, r2);
  return [
    [r0, mab, mca],
    [mab, r1, mbc],
    [mbc, r2, mca],
    [mab, mbc, mca],
  ];
}

const HEX = "0123456789ABCDEF";

/**
 * Decode one triangle's paint string into leaf triangles with a state
 * (0 = unpainted → part's filament, n = filament slot n).
 * The hex string is read right-to-left, one nibble per character. Each node:
 * low 2 bits = number of split sides; if split, the high 2 bits are the
 * "special side" and the children follow depth-first, last child first. If
 * not split, the high 2 bits are the state, where 0b11 means "extended": the
 * following nibbles hold (15 × runs of 0xF) + final nibble + 3.
 */
export function decodePaint(str: string, tri: [V3, V3, V3], emit: (state: number, t: [V3, V3, V3]) => void): boolean {
  const nibbles: number[] = [];
  for (let i = str.length - 1; i >= 0; i--) {
    const n = HEX.indexOf(str[i].toUpperCase());
    if (n < 0) return false;
    nibbles.push(n);
  }
  let pos = 0;
  const next = () => {
    if (pos >= nibbles.length) throw new Error("truncated");
    return nibbles[pos++];
  };
  const node = (t: [V3, V3, V3], depth: number) => {
    if (depth > 24) throw new Error("too deep");
    const code = next();
    const sides = code & 0b11;
    if (sides === 0) {
      let state = code >> 2;
      if ((code & 0b1100) === 0b1100) {
        let n = next();
        let runs = 0;
        while (n === 0b1111) {
          runs++;
          n = next();
        }
        state = n + 15 * runs + 3;
      }
      emit(state, t);
      return;
    }
    const children = splitTriangle(t, sides, code >> 2);
    for (let i = children.length - 1; i >= 0; i--) node(children[i], depth + 1);
  };
  try {
    node(tri, 0);
    return true;
  } catch {
    return false;
  }
}

// ── XML helpers ──────────────────────────────────────────────────────────────

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("This .3mf has a damaged model file.");
  return doc;
}

/** Namespace-agnostic child lookup (3MF files mix default and prefixed namespaces). */
const byTag = (el: Element | Document, tag: string) => Array.from(el.getElementsByTagNameNS("*", tag));
const childrenByTag = (el: Element, tag: string) => Array.from(el.children).filter((c) => c.localName === tag);

function attr(el: Element, name: string): string | null {
  if (el.hasAttribute(name)) return el.getAttribute(name);
  for (const a of Array.from(el.attributes)) if (a.localName === name.split(":").pop()) return a.value;
  return null;
}

function metadata(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of childrenByTag(el, "metadata")) {
    const key = m.getAttribute("key");
    if (key) out[key] = m.getAttribute("value") ?? "";
  }
  return out;
}

// ── Model structure ──────────────────────────────────────────────────────────

interface MeshObject {
  vertices: Float64Array;
  triangles: Uint32Array;
  paint: (string | null)[];
}

interface ModelFile {
  unitScale: number;
  /** Standard 3MF object color (colorgroup/basematerials via pid/pindex), for files without slicer settings. */
  objectColors: Map<string, string>;
  meshes: Map<string, MeshObject>;
  components: Map<string, { path: string; objectId: string; transform: Mat }[]>;
  names: Map<string, string>;
}

const UNIT_MM: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

function readModelFile(doc: Document, path: string): ModelFile {
  const model = doc.documentElement;
  const file: ModelFile = {
    unitScale: UNIT_MM[model.getAttribute("unit") ?? "millimeter"] ?? 1,
    meshes: new Map(),
    components: new Map(),
    names: new Map(),
    objectColors: new Map(),
  };
  const palettes = new Map<string, string[]>();
  for (const g of byTag(doc, "colorgroup")) {
    palettes.set(g.getAttribute("id") ?? "", byTag(g, "color").map((c) => c.getAttribute("color") ?? ""));
  }
  for (const g of byTag(doc, "basematerials")) {
    palettes.set(g.getAttribute("id") ?? "", byTag(g, "base").map((b) => b.getAttribute("displaycolor") ?? ""));
  }
  for (const obj of byTag(doc, "object")) {
    const id = obj.getAttribute("id");
    if (!id) continue;
    const name = obj.getAttribute("name");
    if (name) file.names.set(id, name);
    const color = palettes.get(obj.getAttribute("pid") ?? "")?.[Number(obj.getAttribute("pindex") ?? 0)];
    if (color && /^#[0-9a-f]{6}/i.test(color)) file.objectColors.set(id, color.slice(0, 7).toUpperCase());

    const mesh = childrenByTag(obj, "mesh")[0];
    if (mesh) {
      const vs = byTag(mesh, "vertex");
      const vertices = new Float64Array(vs.length * 3);
      vs.forEach((v, i) => {
        vertices[i * 3] = Number(v.getAttribute("x"));
        vertices[i * 3 + 1] = Number(v.getAttribute("y"));
        vertices[i * 3 + 2] = Number(v.getAttribute("z"));
      });
      const ts = byTag(mesh, "triangle");
      const triangles = new Uint32Array(ts.length * 3);
      const paint: (string | null)[] = new Array(ts.length);
      ts.forEach((t, i) => {
        triangles[i * 3] = Number(t.getAttribute("v1"));
        triangles[i * 3 + 1] = Number(t.getAttribute("v2"));
        triangles[i * 3 + 2] = Number(t.getAttribute("v3"));
        paint[i] = t.getAttribute("paint_color") || attr(t, "slic3rpe:mmu_segmentation") || null;
      });
      file.meshes.set(id, { vertices, triangles, paint });
    }

    const comps = childrenByTag(obj, "components")[0];
    if (comps) {
      file.components.set(
        id,
        childrenByTag(comps, "component").map((c) => ({
          path: (attr(c, "p:path") ?? path).replace(/^\//, ""),
          objectId: c.getAttribute("objectid") ?? "",
          transform: parseTransform(c.getAttribute("transform")),
        })),
      );
    }
  }
  return file;
}

interface PartConfig {
  name?: string;
  extruder?: number;
  subtype?: string;
  /** Older format: triangle range inside a single-mesh object. */
  range?: [number, number];
}

interface ObjectConfig {
  name?: string;
  extruder?: number;
  parts: Map<string, PartConfig>;
  ranges: PartConfig[];
}

function readModelSettings(text: string | undefined) {
  const objects = new Map<string, ObjectConfig>();
  const plateOf = new Map<string, number>();
  if (!text) return { objects, plateOf };
  const doc = parseXml(text);
  // Bambu: <object><part/></object>. Prusa (Slic3r_PE_model.config): <object><volume firstid lastid/></object>.
  for (const obj of byTag(doc, "object")) {
    const id = obj.getAttribute("id");
    if (!id) continue;
    const meta = metadata(obj);
    const cfg: ObjectConfig = {
      name: meta.name,
      extruder: Number(meta.extruder) || undefined,
      parts: new Map(),
      ranges: [],
    };
    for (const part of [...childrenByTag(obj, "part"), ...childrenByTag(obj, "volume")]) {
      const pm = metadata(part);
      const pc: PartConfig = {
        name: pm.name,
        extruder: Number(pm.extruder) || undefined,
        subtype: part.getAttribute("subtype") ?? pm.volume_type?.toLowerCase(),
      };
      const first = part.getAttribute("firstid");
      const last = part.getAttribute("lastid");
      if (last && Number(last) > 0) cfg.ranges.push({ ...pc, range: [Number(first), Number(last)] });
      else if (part.getAttribute("id")) cfg.parts.set(part.getAttribute("id")!, pc);
    }
    objects.set(id, cfg);
  }
  for (const plate of byTag(doc, "plate")) {
    const n = Number(metadata(plate).plater_id) || 1;
    for (const inst of childrenByTag(plate, "model_instance")) {
      const objectId = metadata(inst).object_id;
      if (objectId && !plateOf.has(objectId)) plateOf.set(objectId, n);
    }
  }
  return { objects, plateOf };
}

function readSlots(zip: Record<string, Uint8Array>): ImportedSlot[] {
  const raw = zip["Metadata/project_settings.config"];
  if (!raw) return [];
  try {
    const cfg = JSON.parse(strFromU8(raw));
    const colors: string[] = cfg.filament_colour ?? cfg.filament_color ?? [];
    const types: string[] = cfg.filament_type ?? [];
    const names: string[] = cfg.filament_settings_id ?? [];
    return colors.map((c, i) => ({
      slot: i + 1,
      hex: /^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7).toUpperCase() : "#888888",
      type: types[i],
      name: names[i],
    }));
  } catch {
    return [];
  }
}

// ── Import ───────────────────────────────────────────────────────────────────

/** Append-only Float32 buffer (painted models can reach millions of triangles). */
class Floats {
  private data = new Float32Array(9 * 1024);
  length = 0;
  push9(t: [V3, V3, V3]) {
    if (this.length + 9 > this.data.length) {
      const bigger = new Float32Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    const d = this.data;
    let o = this.length;
    for (const v of t) {
      d[o++] = v[0];
      d[o++] = v[1];
      d[o++] = v[2];
    }
    this.length = o;
  }
  toArray() {
    return this.data.slice(0, this.length);
  }
}

/** Normal parts only: skip modifiers, support blockers/enforcers and negative volumes. */
const isSolid = (subtype?: string) => !subtype || subtype === "normal_part" || subtype === "modelpart";

export async function import3mf(file: File): Promise<Imported3mf> {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(`${file.name} isn't a valid .3mf file.`);
  }
  const findEntry = (path: string) =>
    Object.keys(zip).find((k) => k.toLowerCase() === path.toLowerCase().replace(/^\//, ""));

  const rootPath = findEntry("3D/3dmodel.model");
  if (!rootPath) throw new Error("This .3mf doesn't contain a 3D model.");
  const files = new Map<string, ModelFile>();
  const loadFile = (path: string): ModelFile | undefined => {
    const key = findEntry(path);
    if (!key) return undefined;
    if (!files.has(key)) files.set(key, readModelFile(parseXml(strFromU8(zip[key])), key));
    return files.get(key);
  };
  const rootDoc = parseXml(strFromU8(zip[rootPath]));
  const root = loadFile(rootPath)!;

  const title = byTag(rootDoc, "metadata").find((m) => m.getAttribute("name") === "Title")?.textContent?.trim() || undefined;
  const settingsKey = findEntry("Metadata/model_settings.config") ?? findEntry("Metadata/Slic3r_PE_model.config");
  const { objects: configs, plateOf } = readModelSettings(settingsKey ? strFromU8(zip[settingsKey]) : undefined);
  const slots = readSlots(zip);
  const notes: string[] = [];
  // Plain 3MFs (no slicer settings): each distinct object color becomes a slot.
  const hasProjectSlots = slots.length > 0;
  const colorSlot = (hex: string | undefined): number | undefined => {
    if (!hex || hasProjectSlots) return undefined;
    let s = slots.find((x) => x.hex === hex);
    if (!s) slots.push((s = { slot: slots.length + 1, hex }));
    return s.slot;
  };

  const regions = new Map<string, { meta: Omit<ImportedRegion, "positions">; out: Floats }>();
  const add = (meta: Omit<ImportedRegion, "positions">, t: [V3, V3, V3]) => {
    const key = `${meta.sourceKey}|${meta.slot}|${meta.painted}`;
    let r = regions.get(key);
    if (!r) regions.set(key, (r = { meta, out: new Floats() }));
    r.out.push9(t);
  };

  let paintFailures = 0;
  const emitMesh = (
    mesh: MeshObject,
    world: Mat,
    base: Omit<ImportedRegion, "positions" | "slot" | "painted">,
    baseSlot: number,
    range?: [number, number],
  ) => {
    const tmp: number[] = new Array(9);
    const [from, to] = range ?? [0, mesh.triangles.length / 3 - 1];
    for (let i = from; i <= to && i < mesh.triangles.length / 3; i++) {
      for (let k = 0; k < 3; k++) {
        const vi = mesh.triangles[i * 3 + k] * 3;
        apply(world, mesh.vertices[vi], mesh.vertices[vi + 1], mesh.vertices[vi + 2], tmp, k * 3);
      }
      const tri: [V3, V3, V3] = [
        [tmp[0], tmp[1], tmp[2]],
        [tmp[3], tmp[4], tmp[5]],
        [tmp[6], tmp[7], tmp[8]],
      ];
      const paint = mesh.paint[i];
      if (paint && paint !== "0") {
        const ok = decodePaint(paint, tri, (state, t) =>
          add({ ...base, slot: state || baseSlot, painted: !!state && state !== baseSlot }, t),
        );
        if (ok) continue;
        paintFailures++;
      }
      add({ ...base, slot: baseSlot, painted: false }, tri);
    }
  };

  // Build items = what's actually on the plates. Keep one instance per object
  // (plates often hold several copies for batch printing).
  const seen = new Map<string, number>();
  const items = byTag(rootDoc, "item");
  for (const item of items) {
    const objectId = item.getAttribute("objectid") ?? "";
    seen.set(objectId, (seen.get(objectId) ?? 0) + 1);
    if (seen.get(objectId)! > 1) continue;

    const unit = root.unitScale;
    const itemMat = compose(parseTransform(item.getAttribute("transform")), [unit, 0, 0, 0, unit, 0, 0, 0, unit, 0, 0, 0]);
    const cfg = configs.get(objectId);
    const objectName = cfg?.name || root.names.get(objectId) || `Object ${objectId}`;
    const plate = plateOf.get(objectId) ?? 1;
    const objectSlot = cfg?.extruder ?? colorSlot(root.objectColors.get(objectId)) ?? 1;

    const comps = root.components.get(objectId);
    if (comps) {
      for (const comp of comps) {
        const part = cfg?.parts.get(comp.objectId);
        if (!isSolid(part?.subtype)) continue;
        const f = loadFile(comp.path);
        const mesh = f?.meshes.get(comp.objectId);
        if (!mesh) continue;
        const partName = part?.name || f?.names.get(comp.objectId) || objectName;
        emitMesh(
          mesh,
          compose(comp.transform, itemMat),
          { objectName, partName, sourceKey: `${objectId}/${comp.objectId}`, plate },
          part?.extruder ?? objectSlot,
        );
      }
    } else {
      const mesh = root.meshes.get(objectId);
      if (!mesh) continue;
      if (cfg?.ranges.length) {
        cfg.ranges.forEach((r, i) => {
          if (!isSolid(r.subtype)) return;
          emitMesh(
            mesh,
            itemMat,
            { objectName, partName: r.name || objectName, sourceKey: `${objectId}/${i}`, plate },
            r.extruder ?? objectSlot,
            r.range,
          );
        });
      } else {
        emitMesh(mesh, itemMat, { objectName, partName: objectName, sourceKey: objectId, plate }, objectSlot);
      }
    }
  }

  const copies = [...seen.values()].filter((n) => n > 1).length;
  if (copies) notes.push(`Some objects had several copies on the plate, so one of each was imported.`);
  if (paintFailures) notes.push(`${paintFailures} painted triangles couldn't be read and use their part's color.`);
  if (!regions.size) throw new Error("No printable parts were found in this .3mf.");

  // Lay plates side by side: slicers place plate 2+ far away in world space.
  const out = [...regions.values()].map(({ meta, out }) => ({ ...meta, positions: out.toArray() }));
  const plates = [...new Set(out.map((r) => r.plate))].sort((a, b) => a - b);
  if (plates.length > 1) {
    let cursor = 0;
    for (const plate of plates) {
      const inPlate = out.filter((r) => r.plate === plate);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const r of inPlate) {
        for (let i = 0; i < r.positions.length; i += 3) {
          minX = Math.min(minX, r.positions[i]);
          maxX = Math.max(maxX, r.positions[i]);
          minY = Math.min(minY, r.positions[i + 1]);
          maxY = Math.max(maxY, r.positions[i + 1]);
        }
      }
      const dx = cursor - minX;
      const dy = -(minY + maxY) / 2;
      for (const r of inPlate) {
        for (let i = 0; i < r.positions.length; i += 3) {
          r.positions[i] += dx;
          r.positions[i + 1] += dy;
        }
      }
      cursor += maxX - minX + 15;
    }
  }

  const usedSlots = new Set(out.map((r) => r.slot));
  const allSlots = slots.length ? slots : [...usedSlots].map((slot) => ({ slot, hex: "#888888" }));
  return { title, regions: out, slots: allSlots.filter((s) => usedSlots.has(s.slot)), plates, notes };
}
