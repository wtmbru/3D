import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getFilament } from "@/lib/pricing";
import type { Catalog, ColorConfig, Product } from "@/lib/types";
import { filamentMaterialProps, fitDistance, layoutProduct, loadProductGeometry } from "./models";

/**
 * Renders product thumbnails with a single shared WebGL renderer.
 * Browsers cap live WebGL contexts (~16), so a grid of <Canvas> cards would
 * break; instead we render each card once to a PNG and cache it.
 */

const SIZE = 640;
let renderer: THREE.WebGLRenderer | null = null;
let envMap: THREE.Texture | null = null;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<string>>();

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.NeutralToneMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  return renderer;
}

async function render(catalog: Catalog, product: Product, config: ColorConfig): Promise<string> {
  const geo = await loadProductGeometry(product);
  const layout = layoutProduct(geo, product);
  const r = getRenderer();
  const scene = new THREE.Scene();
  scene.environment = envMap;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 2, 1.5);
  scene.add(key);

  const materials: THREE.Material[] = [];
  for (const part of product.parts) {
    const f = getFilament(catalog, config[part.id] ?? part.defaultFilament);
    const mat = new THREE.MeshPhysicalMaterial(f ? filamentMaterialProps(f) : {});
    materials.push(mat);
    const mesh = new THREE.Mesh(geo.parts[part.id], mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(layout.matrices[part.id]);
    scene.add(mesh);
  }

  const center = layout.box.getCenter(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  const dist = fitDistance(layout.radius, 30, 1, 1.05);
  const dir = new THREE.Vector3(0.55, 0.42, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.lookAt(center);

  r.render(scene, camera);
  const url = r.domElement.toDataURL("image/png");
  materials.forEach((m) => m.dispose());
  return url;
}

export function renderThumbnail(catalog: Catalog, product: Product, config: ColorConfig): Promise<string> {
  // Key on everything that changes the picture: model files and each part's color.
  const looks = product.parts.map((p) => {
    const f = getFilament(catalog, config[p.id] ?? p.defaultFilament);
    return `${p.file}:${f?.hex}:${f?.finish}:${JSON.stringify(p.transform ?? null)}`;
  });
  const key = `${product.upAxis ?? "z"}|${product.layout ?? "assembled"}|${looks.join("|")}`;
  let pending = cache.get(key);
  if (!pending) {
    // Serialize renders — they share one canvas.
    pending = queue.then(() => render(catalog, product, config));
    queue = pending.catch(() => undefined);
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

/**
 * Preview raw imported geometry (triangle soups in slicer Z-up space), e.g.
 * one picture per object in the .3mf import dialog.
 */
export function renderSoupPreview(meshes: { positions: Float32Array; hex: string }[]): Promise<string> {
  const run = async () => {
    const r = getRenderer();
    const scene = new THREE.Scene();
    scene.environment = envMap;
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1, 2, 1.5);
    scene.add(key);
    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2; // Z-up → Y-up
    const disposables: { dispose(): void }[] = [];
    for (const m of meshes) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(m.hex), roughness: 0.55 });
      root.add(new THREE.Mesh(geo, mat));
      disposables.push(geo, mat);
    }
    scene.add(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10000);
    camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3(0.55, 0.5, 1).normalize(), fitDistance(sphere.radius, 30, 1, 1.05));
    camera.lookAt(sphere.center);
    r.render(scene, camera);
    const url = r.domElement.toDataURL("image/png");
    disposables.forEach((d) => d.dispose());
    return url;
  };
  const pending = queue.then(run);
  queue = pending.catch(() => undefined);
  return pending;
}
