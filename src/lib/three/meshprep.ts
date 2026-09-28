/**
 * Makes customer-facing models web-sized (browser only).
 *
 * Slicer models (especially painted ones, where paint subdivides triangles)
 * can run to millions of triangles: too big to upload (50 MB/file) and too
 * heavy for phones. Before upload we:
 *   1. simplify meshes above a triangle budget (meshoptimizer), locking open
 *      borders so color regions cut from one painted mesh still meet exactly;
 *   2. write a binary STL and gzip it (~3–4× smaller).
 * Only the web preview is affected. Prints come from her own slicer files.
 */
import { gzipSync } from "fflate";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";

/** Triangles for a whole product. Plenty for detail; still smooth on phones. */
export const PRODUCT_TRIANGLE_BUDGET = 400_000;
/** Never simplify a part below this. */
const MIN_PART_TRIANGLES = 3_000;
/** Largest allowed deviation, relative to model size (1% ≈ 0.5 mm on a 5 cm figure). */
const MAX_ERROR = 0.01;

export interface PreparedModel {
  file: File;
  trianglesBefore: number;
  trianglesAfter: number;
}

/** Split a product-wide budget across parts, in proportion to their size. */
export function allocateBudget(triangleCounts: number[], total = PRODUCT_TRIANGLE_BUDGET): number[] {
  const sum = triangleCounts.reduce((a, b) => a + b, 0);
  if (sum <= total) return triangleCounts;
  return triangleCounts.map((n) => Math.min(n, Math.max(MIN_PART_TRIANGLES, Math.floor((n / sum) * total))));
}

async function simplify(soup: Float32Array, maxTriangles: number): Promise<Float32Array> {
  const triangles = soup.length / 9;
  if (triangles <= maxTriangles) return soup;
  await MeshoptSimplifier.ready;

  // Weld: map each soup vertex to the first vertex at the same position.
  const remap = MeshoptSimplifier.generatePositionRemap(soup, 3);
  const indices = new Uint32Array(remap.length);
  for (let i = 0; i < remap.length; i++) indices[i] = remap[i];

  let [kept] = MeshoptSimplifier.simplify(indices, soup, 3, maxTriangles * 3, MAX_ERROR, ["LockBorder"]);
  // Very fine paint leaves almost every edge on a color border, which locking
  // freezes. Then unlock borders: seams between colors may shift by a hair.
  if (kept.length / 3 > maxTriangles * 1.25) {
    [kept] = MeshoptSimplifier.simplify(indices, soup, 3, maxTriangles * 3, MAX_ERROR * 2);
  }
  // Last resort for speckled paint (thousands of disconnected specks that
  // edge collapse can't merge): cluster nearby vertices instead.
  if (kept.length / 3 > maxTriangles * 1.25) {
    [kept] = MeshoptSimplifier.simplifySloppy(indices, soup, 3, null, maxTriangles * 3, MAX_ERROR * 2);
  }
  if (kept.length === 0) return soup; // degenerate input; keep it as it was

  const out = new Float32Array(kept.length * 3);
  for (let i = 0; i < kept.length; i++) {
    const v = kept[i] * 3;
    out[i * 3] = soup[v];
    out[i * 3 + 1] = soup[v + 1];
    out[i * 3 + 2] = soup[v + 2];
  }
  return out;
}

function binaryStl(positions: Float32Array): Uint8Array {
  const count = positions.length / 9;
  const bytes = new Uint8Array(84 + count * 50);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, count, true);
  let o = 84;
  for (let t = 0; t < count; t++) {
    const p = t * 9;
    const ax = positions[p + 3] - positions[p], ay = positions[p + 4] - positions[p + 1], az = positions[p + 5] - positions[p + 2];
    const bx = positions[p + 6] - positions[p], by = positions[p + 7] - positions[p + 1], bz = positions[p + 8] - positions[p + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    view.setFloat32(o, nx, true);
    view.setFloat32(o + 4, ny, true);
    view.setFloat32(o + 8, nz, true);
    for (let i = 0; i < 9; i++) view.setFloat32(o + 12 + i * 4, positions[p + i], true);
    o += 50;
  }
  return bytes;
}

/** Simplify (if needed) and pack a triangle soup as a gzipped STL named `<base>.stl.gz`. */
export async function prepareModel(positions: Float32Array, base: string, maxTriangles: number): Promise<PreparedModel> {
  const simplified = await simplify(positions, maxTriangles);
  const packed = gzipSync(binaryStl(simplified), { level: 6 });
  return {
    file: new File([packed], `${base || "part"}.stl.gz`, { type: "application/octet-stream" }),
    trianglesBefore: positions.length / 9,
    trianglesAfter: simplified.length / 9,
  };
}

/** True for gzip data (magic bytes 1f 8b). */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}
