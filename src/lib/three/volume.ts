import type * as THREE from "three";

/**
 * Volume of a closed mesh in mm³ (sum of signed tetrahedra to the origin). Only meaningful for
 * a whole solid: a piece that's just part of a surface (like one painted color region) isn't.
 */
export function meshVolume(geometry: THREE.BufferGeometry): number {
  const pos = geometry.getAttribute("position");
  if (!pos) return 0;
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;
  let sum = 0;
  for (let i = 0; i + 2 < count; i += 3) {
    const a = index ? index.getX(i) : i;
    const b = index ? index.getX(i + 1) : i + 1;
    const c = index ? index.getX(i + 2) : i + 2;
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
    const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
    const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
    sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return sum / 6;
}

/** Total volume of several pieces that together make up closed solids. */
export function totalVolume(geometries: THREE.BufferGeometry[]): number {
  return Math.abs(geometries.reduce((n, g) => n + meshVolume(g), 0));
}
