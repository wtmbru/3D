/**
 * Generates the sample multi-part STL models in public/models.
 *
 * Each product is split into one STL per color region ("part"), the same way
 * a real multicolor model is exported from Bambu Studio (right click → Export
 * as one STL per part). Models are authored Y-up with three.js primitives and
 * rotated to Z-up on export so they match real slicer exports.
 *
 * Run: npx tsx scripts/generate-sample-models.ts
 */
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const OUT_DIR = path.join(process.cwd(), "public", "models");
const exporter = new STLExporter();

type Part = THREE.Object3D;

function mesh(
  geometry: THREE.BufferGeometry,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const m = new THREE.Mesh(geometry);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.scale.set(...scale);
  return m;
}

function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}

function writeModel(slug: string, parts: Record<string, Part>) {
  const dir = path.join(OUT_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, part] of Object.entries(parts)) {
    // Y-up → Z-up, like a slicer export.
    const root = new THREE.Group();
    root.rotation.x = Math.PI / 2;
    root.add(part);
    root.updateMatrixWorld(true);
    const data = exporter.parse(root, { binary: true }) as DataView;
    const file = path.join(dir, `${name}.stl`);
    fs.writeFileSync(file, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    console.log(`  ${slug}/${name}.stl  ${(data.byteLength / 1024).toFixed(0)} KB`);
  }
}

const sphere = (r: number, w = 48, h = 32) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt: number, rb: number, h: number, s = 48) => new THREE.CylinderGeometry(rt, rb, h, s);
const lathe = (pts: [number, number][], s = 64) =>
  new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s);

// ── Bloop the Robot ──────────────────────────────────────────────────────────
function robot() {
  const shell = group(
    mesh(new RoundedBoxGeometry(30, 26, 22, 6, 5), [0, 21, 0]), // torso
    mesh(new RoundedBoxGeometry(38, 28, 28, 6, 8), [0, 50, 0]), // head
    mesh(new THREE.CapsuleGeometry(4, 12, 8, 24), [-19, 22, 0], [0, 0, 0.35]), // arms
    mesh(new THREE.CapsuleGeometry(4, 12, 8, 24), [19, 22, 0], [0, 0, -0.35]),
    mesh(cyl(5, 5, 8), [0, 38, 0]), // neck
  );
  const face = group(mesh(new RoundedBoxGeometry(30, 18, 3, 4, 3), [0, 50, 13.5]));
  const details = group(
    mesh(sphere(3.6), [-7, 51, 15]), // eyes
    mesh(sphere(3.6), [7, 51, 15]),
    mesh(cyl(2.6, 2.6, 2), [-6, 24, 11], [Math.PI / 2, 0, 0]), // buttons
    mesh(cyl(2.6, 2.6, 2), [0, 24, 11], [Math.PI / 2, 0, 0]),
    mesh(cyl(2.6, 2.6, 2), [6, 24, 11], [Math.PI / 2, 0, 0]),
  );
  const feetAndAntenna = group(
    mesh(new RoundedBoxGeometry(12, 8, 18, 4, 3), [-8, 4, 1]),
    mesh(new RoundedBoxGeometry(12, 8, 18, 4, 3), [8, 4, 1]),
    mesh(cyl(1.4, 1.4, 10), [0, 68, 0]),
    mesh(sphere(4), [0, 74, 0]),
  );
  writeModel("bloop-robot", { shell, face, details, accents: feetAndAntenna });
}

// ── Toadstool Cottage ────────────────────────────────────────────────────────
function toadstool() {
  const capProfile: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * (Math.PI / 2);
    capProfile.push([Math.cos(t) * 36, 34 + Math.sin(t) * 26]);
  }
  capProfile.unshift([30, 32], [36, 33]);
  capProfile.unshift([0, 32]);
  const cap = group(mesh(lathe(capProfile)));

  const spots = new THREE.Group();
  const spotAngles = [
    [0.35, 0.2], [0.35, 2.2], [0.35, 4.3], [0.8, 1.1], [0.8, 3.3], [0.8, 5.4], [1.2, 0],
  ];
  for (const [polar, az] of spotAngles) {
    const r = 36;
    const dir = new THREE.Vector3(
      Math.sin(polar) * Math.cos(az),
      Math.cos(polar) * (26 / 36),
      Math.sin(polar) * Math.sin(az),
    );
    const p = new THREE.Vector3(dir.x * r, 34 + dir.y * r, dir.z * r);
    const s = mesh(sphere(polar > 1 ? 4 : 5.5, 32, 16), [p.x, p.y, p.z], [0, 0, 0], [1, 0.45, 1]);
    s.lookAt(new THREE.Vector3(0, 20, 0));
    s.rotateX(Math.PI / 2);
    spots.add(s);
  }

  const stem = group(
    mesh(lathe([[0, 0], [20, 0], [21, 2], [19, 18], [16, 33], [0, 33]])),
  );
  const door = group(
    // Arched top: half cylinder, flat side down, facing out of the stem.
    mesh(new THREE.CylinderGeometry(6, 6, 3, 32, 1, false, -Math.PI / 2, Math.PI), [0, 12, 19.2], [-Math.PI / 2, 0, 0]),
    mesh(new THREE.BoxGeometry(12, 12, 3), [0, 6, 19.2]),
    mesh(sphere(3, 24, 16), [-10, 24, 15.5], [0, -0.5, 0], [1, 1, 0.5]), // round window
    mesh(sphere(3, 24, 16), [11, 22, 14.5], [0, 0.6, 0], [1, 1, 0.5]),
  );
  writeModel("toadstool-cottage", { cap, spots, stem, door });
}

// ── Stripe Planter ───────────────────────────────────────────────────────────
function planter() {
  // Hollow pot: outer wall up, lip, inner wall down.
  const pot = group(
    mesh(lathe([[0, 6], [34, 6], [42, 70], [46, 70], [46, 76], [40, 76], [36, 12], [0, 12]], 96)),
  );
  const band = group(mesh(lathe([[38.6, 30], [39.4, 30], [40.6, 46], [39.8, 46]], 96), [0, 0, 0], [0, 0, 0], [1.03, 1, 1.03]));
  const saucer = group(mesh(lathe([[0, 0], [44, 0], [48, 8], [45, 8], [41, 3], [0, 3]], 96)));
  writeModel("stripe-planter", { pot, band, saucer });
}

// ── Rocket Pencil Cup ────────────────────────────────────────────────────────
function rocket() {
  const body = group(
    mesh(lathe([[0, 8], [22, 8], [24, 20], [24, 70], [20, 92], [16, 92], [20, 70], [20, 20], [18, 14], [0, 14]], 96)),
  );
  const nose = group(
    mesh(lathe([[16.5, 92], [20.5, 92], [20.5, 97], [16.5, 97]], 96)), // rim ring
  );
  const fins = new THREE.Group();
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(18, -8);
  finShape.lineTo(18, 4);
  finShape.lineTo(0, 36);
  finShape.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 4, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 3 });
  finGeo.translate(0, 0, -2);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const f = mesh(finGeo, [Math.cos(a) * 21, 8, Math.sin(a) * 21], [0, -a, 0]);
    fins.add(f);
  }
  fins.add(mesh(lathe([[0, 0], [16, 0], [22, 8], [0, 8]], 96)));
  const window = group(
    mesh(new THREE.TorusGeometry(8, 2, 16, 48), [0, 54, 24]),
    mesh(cyl(7, 7, 2, 48), [0, 54, 23.4], [Math.PI / 2, 0, 0]),
  );
  writeModel("rocket-pencil-cup", { body, fins, window, rim: nose });
}

// ── Star Bag Charm ───────────────────────────────────────────────────────────
function starCharm() {
  const star = (outer: number, inner: number) => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  };
  const base = new THREE.ExtrudeGeometry(star(30, 15), { depth: 4, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1, bevelSegments: 4 });
  const top = new THREE.ExtrudeGeometry(star(21, 10.5), { depth: 2, bevelEnabled: true, bevelSize: 1, bevelThickness: 0.8, bevelSegments: 3 });
  // Lay flat: extrusion runs along Z → rotate to Y.
  const baseMesh = mesh(base, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  const topMesh = mesh(top, [0, 5, 0], [-Math.PI / 2, 0, 0]);
  const loop = mesh(new THREE.TorusGeometry(6, 2.2, 16, 48), [0, 3, -34], [Math.PI / 2, 0, 0]);
  writeModel("star-bag-charm", { base: group(baseMesh, loop), star: group(topMesh) });
}

// ── Dapper Duck ──────────────────────────────────────────────────────────────
function duck() {
  const body = group(
    mesh(sphere(22), [0, 20, 0], [0, 0, 0], [1.25, 0.85, 1]),
    mesh(sphere(15), [12, 44, 0]),
    mesh(sphere(8, 32, 16), [-24, 28, 0], [0, 0, 0.6], [1.4, 0.7, 0.9]), // tail
  );
  const beak = group(mesh(sphere(7, 32, 16), [26, 42, 0], [0, 0, -0.1], [1.4, 0.55, 1]));
  const eyes = group(mesh(sphere(2.6, 24, 16), [22, 48, -7]), mesh(sphere(2.6, 24, 16), [22, 48, 7]));
  const hat = group(
    mesh(cyl(12, 12, 2, 48), [10, 58, 0], [0, 0, -0.15]),
    mesh(cyl(7.5, 8, 14, 48), [9, 65, 0], [0, 0, -0.15]),
  );
  writeModel("dapper-duck", { body, beak, eyes, hat });
}

// ── Stud Brick Charm (one model per size option) ────────────────────────────
function bricks() {
  const unit = 16; // stud pitch, mm
  for (const [nx, ny] of [[1, 1], [1, 2], [2, 2], [2, 3]]) {
    const w = nx * unit;
    const d = ny * unit;
    const brick = group(mesh(new RoundedBoxGeometry(w, 12, d, 4, 1.5), [0, 6, 0]));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        brick.add(mesh(cyl(4.8, 4.8, 3, 40), [(i + 0.5) * unit - w / 2, 13.5, (j + 0.5) * unit - d / 2]));
      }
    }
    writeModel(`stud-brick-${nx}x${ny}`, { brick });
  }
}

console.log("Generating sample models →", OUT_DIR);
robot();
toadstool();
planter();
rocket();
starCharm();
duck();
bricks();
