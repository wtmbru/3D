"use client";

import { nearestFilament } from "@/lib/pricing";
import type { Imported3mf, ImportedRegion } from "@/lib/three/threemf";
import type { Catalog, MaterialFamily } from "@/lib/types";

export type Grouping = "color" | "part";

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

/**
 * Turn imported regions into customer-facing parts.
 * "color": one part per filament slot per plate. This matches how the
 *   project was set up, and painted details become their own part.
 * "part": every slicer part/object separately, split by color if painted.
 */
export function groupRegions(model: Imported3mf, grouping: Grouping, catalog: Catalog, family: MaterialFamily): ImportGroup[] {
  const buckets = new Map<string, ImportedRegion[]>();
  for (const r of model.regions) {
    const key = grouping === "color" ? `${r.plate}|${r.slot}` : `${r.plate}|${r.sourceKey}|${r.slot}`;
    buckets.set(key, [...(buckets.get(key) ?? []), r]);
  }

  const used = new Map<string, number>();
  return [...buckets.entries()]
    .map(([key, regions]) => {
      const first = regions[0];
      const whole = regions.filter((r) => !r.painted);
      // Name after the parts that use this color; paint-only colors are "details".
      let name = whole.length
        ? joinNames(whole.map((r) => r.partName))
        : `${joinNames(regions.map((r) => r.partName))} details`;
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
