import { gunzipSync } from "fflate";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Filament, PartTransform, Product } from "@/lib/types";

/**
 * Part geometries, oriented Y-up but otherwise exactly where the STLs put
 * them. Geometries are shared between products/viewers and never mutated —
 * placement happens with matrices (see layoutProduct).
 */
export interface ProductGeometry {
  parts: Record<string, THREE.BufferGeometry>;
}

export interface ProductLayout {
  /** Final matrix per part: placement (transform or kit spread) + centering. */
  matrices: Record<string, THREE.Matrix4>;
  /** Bounding box of the placed model: centered on X/Z, resting on y = 0. */
  box: THREE.Box3;
  radius: number;
}

const stlLoader = new STLLoader();
const fileCache = new Map<string, Promise<THREE.BufferGeometry>>();

/** Smooth curved surfaces but keep sharp edges sharp (STLs only carry flat face normals). */
const CREASE_ANGLE = THREE.MathUtils.degToRad(35);

function loadPart(url: string, upAxis: "z" | "y"): Promise<THREE.BufferGeometry> {
  const key = `${upAxis}|${url}`;
  let pending = fileCache.get(key);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      let bytes = new Uint8Array(await res.arrayBuffer());
      // Uploaded models are gzipped STLs (see meshprep.ts); older/sample ones are plain.
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
      const raw = stlLoader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      if (upAxis === "z") raw.rotateX(-Math.PI / 2);
      const geo = toCreasedNormals(raw, CREASE_ANGLE);
      raw.dispose();
      geo.computeBoundingBox();
      return geo;
    })();
    pending.catch(() => fileCache.delete(key));
    fileCache.set(key, pending);
  }
  return pending;
}

/**
 * After a local file finishes uploading, point its public URL at the geometry
 * already parsed from the local copy, so the preview doesn't reload it.
 */
export function aliasModelFile(fromUrl: string, toUrl: string) {
  for (const axis of ["z", "y"] as const) {
    const hit = fileCache.get(`${axis}|${fromUrl}`);
    if (hit) fileCache.set(`${axis}|${toUrl}`, hit);
  }
}

export async function loadProductGeometry(product: Pick<Product, "parts" | "upAxis">): Promise<ProductGeometry> {
  const upAxis = product.upAxis ?? "z";
  const entries = await Promise.all(product.parts.map(async (p) => [p.id, await loadPart(p.file, upAxis)] as const));
  return { parts: Object.fromEntries(entries) };
}

/** Matrix for a user placement: rotate around the piece's own center, then move. */
export function transformMatrix(center: THREE.Vector3, t: PartTransform | undefined): THREE.Matrix4 {
  if (!t) return new THREE.Matrix4();
  const rotate = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...t.rotation));
  return new THREE.Matrix4()
    .makeTranslation(center.x + t.position[0], center.y + t.position[1], center.z + t.position[2])
    .multiply(rotate)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
}

/** Kit view: pieces side by side on the floor, in part order, in their print orientation. */
function spreadMatrices(geo: ProductGeometry, parts: Product["parts"]): Record<string, THREE.Matrix4> {
  const boxes = parts.map((p) => geo.parts[p.id].boundingBox!);
  const largest = Math.max(...boxes.map((b) => b.getSize(new THREE.Vector3()).length()), 1);
  const gap = Math.max(4, largest * 0.12);
  let cursor = 0;
  const out: Record<string, THREE.Matrix4> = {};
  parts.forEach((p, i) => {
    const b = boxes[i];
    const c = b.getCenter(new THREE.Vector3());
    out[p.id] = new THREE.Matrix4().makeTranslation(cursor - b.min.x, -b.min.y, -c.z);
    cursor += b.max.x - b.min.x + gap;
  });
  return out;
}

/** Where each part goes, plus bounds for framing the camera. Cheap — call freely. */
export function layoutProduct(
  geo: ProductGeometry,
  product: Pick<Product, "parts" | "layout">,
  options: { center?: boolean } = {},
): ProductLayout {
  const parts = product.parts.filter((p) => geo.parts[p.id]);
  const placement =
    product.layout === "spread"
      ? spreadMatrices(geo, parts)
      : Object.fromEntries(
          parts.map((p) => {
            const b = geo.parts[p.id].boundingBox!;
            return [p.id, transformMatrix(b.getCenter(new THREE.Vector3()), p.transform)];
          }),
        );

  const box = new THREE.Box3();
  for (const p of parts) box.union(geo.parts[p.id].boundingBox!.clone().applyMatrix4(placement[p.id]));
  if (box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));

  // Center on X/Z and rest on the floor.
  const c = box.getCenter(new THREE.Vector3());
  const offset = options.center === false ? new THREE.Matrix4() : new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z);
  const matrices = Object.fromEntries(parts.map((p) => [p.id, offset.clone().multiply(placement[p.id])]));
  box.applyMatrix4(offset);
  return { matrices, box, radius: box.getBoundingSphere(new THREE.Sphere()).radius };
}

/** Physical material settings that make each filament finish read correctly. */
export function filamentMaterialProps(f: Filament): THREE.MeshPhysicalMaterialParameters {
  const color = new THREE.Color(f.hex);
  switch (f.finish) {
    case "matte":
      return { color, roughness: 0.92, metalness: 0, clearcoat: 0 };
    case "silk":
      return {
        color,
        roughness: 0.3,
        metalness: 0.55,
        sheen: 1,
        sheenColor: new THREE.Color(f.hex2 ?? f.hex),
        sheenRoughness: 0.35,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
      };
    case "translucent":
      return { color, roughness: 0.18, metalness: 0, transmission: 0.55, thickness: 6, ior: 1.5 };
    case "sparkle":
      return { color, roughness: 0.4, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 };
    case "basic":
    default:
      return { color, roughness: 0.48, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.45 };
  }
}

export function applyFilament(material: THREE.MeshPhysicalMaterial, f: Filament) {
  // Reset the properties some finishes set so switching finishes is clean.
  material.setValues({
    sheen: 0,
    transmission: 0,
    thickness: 0,
    clearcoat: 0,
    metalness: 0,
    ...filamentMaterialProps(f),
  });
  material.needsUpdate = true;
}

/** Camera distance that fits a sphere of `radius` in a perspective view. */
export function fitDistance(radius: number, fovDeg: number, aspect = 1, padding = 1.25): number {
  const vFov = THREE.MathUtils.degToRad(fovDeg);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const fov = Math.min(vFov, hFov);
  return (radius * padding) / Math.sin(fov / 2);
}
