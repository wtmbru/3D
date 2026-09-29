"use client";

import { nearestFilament } from "@/lib/pricing";
import type { Imported3mf, ImportedRegion } from "@/lib/three/threemf";
import type { Catalog, MaterialFamily } from "@/lib/types";

export type Grouping = "color" | "part" | "object";

/** What a .3mf holds, from the customer's point of view. */
export type Contents = "single" | "options" | "set";

export interface ImportObject {
  key: string;
  name: string;
  plate: number;
  triangles: number;
  /** Footprint and height in mm (slicer space, Z-up). */
  size: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
}

export interface ImportGroup {
  key: string;
  name: string;
  plate: number;
  slot: number;
  slotHex: string;
  /** Closest filament on the wall to the project's slot color. */
  filamentId: string;
  positions: Float32Array;
  triangles: number;
}

function joinNames(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.replace(/\.stl$/i, "").trim()).filter(Boolean))];
  if (unique.length <= 2) return unique.join(" & ") || "Part";
  return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
}

/** One entry per physical object on the plates, with its bounding box. */
export function summarizeObjects(model: Imported3mf): ImportObject[] {
  const objects = new Map<string, ImportObject>();
  for (const r of model.regions) {
    let o = objects.get(r.objectKey);
    if (!o) {
      o = {
        key: r.objectKey,
        name: r.objectName,
        plate: r.plate,
        triangles: 0,
        size: [0, 0, 0],
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      };
      objects.set(r.objectKey, o);
    }
    o.triangles += r.positions.length / 9;
    for (let i = 0; i < r.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        o.min[k] = Math.min(o.min[k], r.positions[i + k]);
        o.max[k] = Math.max(o.max[k], r.positions[i + k]);
      }
    }
  }
  for (const o of objects.values()) o.size = [0, 1, 2].map((k) => o.max[k] - o.min[k]) as ImportObject["size"];
  return [...objects.values()];
}

const SIZE_WORDS =
  /\b(\d+\s*[x×*]\s*\d+(\s*[x×*]\s*\d+)?|x{0,2}s|m|l|x{1,2}l|small|medium|large|mini|big|tiny|huge|v\d+)\b/gi;
const baseName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.stl$/, "")
    .replace(SIZE_WORDS, " ")
    .replace(/[\d_\-.()#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Guess what a multi-object file is, with a reason to show her:
 *   single  – one object, or objects that touch/overlap (pieces of one model)
 *   options – separate objects that look like sizes/versions of one thing
 *   set     – separate, unrelated objects (a kit sold together)
 */
export function detectContents(model: Imported3mf): { suggestion: Contents; reason: string } {
  const objects = summarizeObjects(model);
  if (objects.length < 2) {
    return { suggestion: "single", reason: "The file has one object, so it's one model with its colors." };
  }
  const overlaps = objects.some((a, i) =>
    objects.slice(i + 1).some(
      (b) =>
        a.plate === b.plate &&
        Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]) > 0.5 &&
        Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]) > 0.5,
    ),
  );
  if (overlaps) {
    return {
      suggestion: "single",
      reason: `The ${objects.length} objects touch or overlap, so they look like pieces of one model.`,
    };
  }
  const names = objects.map((o) => o.name);
  const bases = new Set(names.map(baseName));
  // Default names ("Object 1", "part") say nothing about the design.
  const generic = /^(object|part|body|model|mesh|shape|untitled|cube|cylinder)?$/;
  const sameFamily = bases.size === 1 && !generic.test([...bases][0]);
  const sizeLike = names.filter((n) => new RegExp(SIZE_WORDS.source, "i").test(n)).length >= Math.ceil(objects.length / 2);
  if (sameFamily || sizeLike) {
    const sample = names
      .slice(0, 3)
      .map((n) => `"${n}"`)
      .join(", ");
    return {
      suggestion: "options",
      reason: `${objects.length} separate objects whose names look like sizes or versions (${sample}).`,
    };
  }
  const heights = objects.map((o) => o.size[2]);
  const footprints = objects.map((o) => o.size[0] * o.size[1]);
  const similarHeight = Math.min(...heights) / Math.max(...heights) > 0.65;
  const differentFootprint = Math.min(...footprints) / Math.max(...footprints) < 0.8;
  if (similarHeight && differentFootprint) {
    return {
      suggestion: "options",
      reason: `${objects.length} separate objects of the same height in different sizes, which usually means size options.`,
    };
  }
  return {
    suggestion: "set",
    reason: `${objects.length} separate objects with different shapes, like the pieces of a set.`,
  };
}

/** Only the regions of some objects, e.g. one object per option. */
export function subset(model: Imported3mf, objectKeys: string[]): Imported3mf {
  const keys = new Set(objectKeys);
  return { ...model, regions: model.regions.filter((r) => keys.has(r.objectKey)) };
}

/**
 * Turn imported regions into customer-facing parts.
 * "color": one part per filament slot per plate. This matches how the
 *   project was set up, and painted details become their own part.
 * "part": every slicer part/object separately, split by color if painted.
 * "object": each physical object gets its own colors (sets), named after it.
 */
export function groupRegions(model: Imported3mf, grouping: Grouping, catalog: Catalog, family: MaterialFamily): ImportGroup[] {
  const buckets = new Map<string, ImportedRegion[]>();
  for (const r of model.regions) {
    const key =
      grouping === "color"
        ? `${r.plate}|${r.slot}`
        : grouping === "object"
          ? `${r.plate}|${r.objectKey}|${r.slot}`
          : `${r.plate}|${r.sourceKey}|${r.slot}`;
    buckets.set(key, [...(buckets.get(key) ?? []), r]);
  }

  const used = new Map<string, number>();
  return [...buckets.entries()]
    .map(([key, regions]) => {
      const first = regions[0];
      const whole = regions.filter((r) => !r.painted);
      // Name after the parts that use this color; paint-only colors are "details".
      const label = (rs: ImportedRegion[]) => joinNames(rs.map((r) => (grouping === "object" ? r.objectName : r.partName)));
      let name = whole.length ? label(whole) : `${label(regions)} details`;
      const n = (used.get(name) ?? 0) + 1;
      used.set(name, n);
      if (n > 1) name = `${name} ${n}`;

      const length = regions.reduce((sum, r) => sum + r.positions.length, 0);
      const positions = new Float32Array(length);
      let offset = 0;
      for (const r of regions) {
        positions.set(r.positions, offset);
        offset += r.positions.length;
      }
      const slotHex = model.slots.find((s) => s.slot === first.slot)?.hex ?? "#888888";
      return {
        key,
        name: name.slice(0, 40),
        plate: first.plate,
        slot: first.slot,
        slotHex,
        filamentId: nearestFilament(catalog, slotHex, family)?.id ?? "",
        positions,
        triangles: length / 9,
      };
    })
    .sort((a, b) => a.plate - b.plate || a.slot - b.slot || b.triangles - a.triangles);
}

/** Printed size (W × D × H, mm) of everything imported. Slicer space is Z-up. */
export function measure(groups: ImportGroup[]): [number, number, number] {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const g of groups) {
    for (let i = 0; i < g.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], g.positions[i + k]);
        max[k] = Math.max(max[k], g.positions[i + k]);
      }
    }
  }
  return [0, 1, 2].map((k) => (Number.isFinite(max[k]) ? Math.round(max[k] - min[k]) : 0)) as [number, number, number];
}
