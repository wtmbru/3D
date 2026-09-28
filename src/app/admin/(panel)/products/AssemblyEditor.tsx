"use client";

import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCatalog } from "@/components/CatalogProvider";
import { RoomEnv } from "@/components/viewer/ModelViewer";
import { getFilament } from "@/lib/pricing";
import {
  applyFilament,
  fitDistance,
  layoutProduct,
  loadProductGeometry,
  transformMatrix,
  type ProductGeometry,
} from "@/lib/three/models";
import type { ColorConfig, PartTransform, Product } from "@/lib/types";

/*
 * Drag-and-drop piece arranging for the assembled preview.
 *
 * Works in "model space": Y-up millimetres, exactly where the STLs put each
 * piece, so the floor is y = 0 (where slicer exports sit). Each piece is a
 * group placed at (its center + transform.position) with transform.rotation,
 * and the mesh inside is offset by -center, so pieces rotate around their own
 * middle. Positions are only committed to React state when a drag ends —
 * mid-drag re-renders would otherwise snap the piece back.
 */

type Mode = "translate" | "rotate";

interface Props {
  product: Product;
  config: ColorConfig;
  selected: string | null;
  onSelect: (partId: string | null) => void;
  onTransforms: (transforms: Record<string, PartTransform | undefined>) => void;
}

const FOV = 35;
const round = (n: number, step: number) => Math.round(n / step) * step;

export function AssemblyEditor({ product, config, selected, onSelect, onTransforms }: Props) {
  const [geometry, setGeometry] = useState<ProductGeometry | null>(null);
  const [mode, setMode] = useState<Mode>("translate");
  const [snap, setSnap] = useState(true);
  const [frameTick, setFrameTick] = useState(0);
  // Clicking empty space deselects — but not when that "click" ends a gizmo drag or an orbit.
  const gizmoBusy = useRef(false);
  const downAt = useRef<[number, number]>([0, 0]);
  const filesKey = product.parts.map((p) => `${p.id}=${p.file}`).join("|");

  useEffect(() => {
    let live = true;
    loadProductGeometry(product).then((g) => live && setGeometry(g));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesKey, product.upAxis]);

  const centers = useMemo(() => {
    if (!geometry) return {};
    return Object.fromEntries(
      product.parts
        .filter((p) => geometry.parts[p.id])
        .map((p) => [p.id, geometry.parts[p.id].boundingBox!.getCenter(new THREE.Vector3())]),
    );
  }, [geometry, product.parts]);

  const selectedPart = product.parts.find((p) => p.id === selected);

  function update(partId: string, t: PartTransform | undefined) {
    onTransforms({ [partId]: t });
  }

  function rotate90(axis: "x" | "y" | "z") {
    if (!selectedPart) return;
    const t = selectedPart.transform ?? { position: [0, 0, 0], rotation: [0, 0, 0] };
    const current = new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotation));
    const turn = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0),
      Math.PI / 2,
    );
    const e = new THREE.Euler().setFromQuaternion(turn.multiply(current));
    update(selectedPart.id, { position: t.position, rotation: [e.x, e.y, e.z] });
  }

  /** Move the selected piece down (or up) until its lowest point touches the floor. */
  function dropToFloor() {
    if (!selectedPart || !geometry) return;
    const g = geometry.parts[selectedPart.id];
    const t = selectedPart.transform ?? { position: [0, 0, 0], rotation: [0, 0, 0] };
    const box = g.boundingBox!.clone().applyMatrix4(transformMatrix(centers[selectedPart.id], t));
    update(selectedPart.id, { ...t, position: [t.position[0], t.position[1] - box.min.y, t.position[2]] });
  }

  /** Lay every piece out side by side — the easy starting point for a pile of pieces. */
  function spreadAll() {
    if (!geometry) return;
    const spread = layoutProduct(geometry, { parts: product.parts, layout: "spread" }, { center: false });
    const next: Record<string, PartTransform> = {};
    for (const p of product.parts) {
      const c = centers[p.id];
      if (!c) continue;
      const moved = c.clone().applyMatrix4(spread.matrices[p.id]);
      next[p.id] = { position: [moved.x - c.x, moved.y - c.y, moved.z - c.z], rotation: [0, 0, 0] };
    }
    onTransforms(next);
    setFrameTick((n) => n + 1);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b-2 border-ink bg-paper p-2 text-sm">
        <div className="flex rounded-full border-2 border-ink p-0.5" role="group" aria-label="Tool">
          {(["translate", "rotate"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 font-bold ${mode === m ? "bg-ink text-cream" : ""}`}
            >
              {m === "translate" ? "Move" : "Rotate"}
            </button>
          ))}
        </div>
        <ToolButton onClick={() => rotate90("x")} disabled={!selectedPart} title="Turn 90° around the red (X) axis">
          ↻ X
        </ToolButton>
        <ToolButton onClick={() => rotate90("y")} disabled={!selectedPart} title="Turn 90° around the green (Y, up) axis">
          ↻ Y
        </ToolButton>
        <ToolButton onClick={() => rotate90("z")} disabled={!selectedPart} title="Turn 90° around the blue (Z) axis">
          ↻ Z
        </ToolButton>
        <ToolButton onClick={dropToFloor} disabled={!selectedPart} title="Rest the piece on the floor">
          Drop to floor
        </ToolButton>
        <ToolButton onClick={() => selectedPart && update(selectedPart.id, undefined)} disabled={!selectedPart?.transform} title="Put the piece back where the STL had it">
          Reset piece
        </ToolButton>
        <span className="flex-1" />
        <label className="flex items-center gap-1.5 px-1 font-semibold">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          Snap
        </label>
        <ToolButton onClick={spreadAll} title="Lay every piece out side by side">
          Spread out
        </ToolButton>
        <ToolButton onClick={() => setFrameTick((n) => n + 1)} title="Fit everything in view">
          Fit view
        </ToolButton>
      </div>

      <div className="relative min-h-0 flex-1 bg-sky-soft">
        {geometry ? (
          <Canvas
            dpr={[1, 2]}
            camera={{ fov: FOV, near: 1, far: 10000, position: [150, 120, 200] }}
            gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
            onPointerDown={(e) => (downAt.current = [e.clientX, e.clientY])}
            onPointerMissed={(e) => {
              const moved = Math.hypot(e.clientX - downAt.current[0], e.clientY - downAt.current[1]);
              if (!gizmoBusy.current && moved < 4) onSelect(null);
            }}
          >
            <RoomEnv />
            <directionalLight position={[80, 160, 100]} intensity={1.2} />
            <Grid
              position={[0, -0.01, 0]}
              infiniteGrid
              cellSize={5}
              sectionSize={50}
              cellColor="#9a93b3"
              sectionColor="#5b527a"
              fadeDistance={1500}
              followCamera={false}
            />
            <Framer geometry={geometry} product={product} tick={frameTick} />
            {product.parts
              .filter((p) => geometry.parts[p.id])
              .map((part) => (
                <Piece
                  key={part.id}
                  geometry={geometry.parts[part.id]}
                  center={centers[part.id]}
                  transform={part.transform}
                  filamentId={config[part.id] ?? part.defaultFilament}
                  selected={part.id === selected}
                  mode={mode}
                  snap={snap}
                  onSelect={() => onSelect(part.id)}
                  onCommit={(t) => update(part.id, t)}
                  onDragStart={() => (gizmoBusy.current = true)}
                  // The click that ends a drag fires right after mouseup; release afterwards.
                  onDragEnd={() => setTimeout(() => (gizmoBusy.current = false), 0)}
                />
              ))}
            <OrbitControls makeDefault enableDamping={false} />
          </Canvas>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-ink-soft">Loading pieces…</div>
        )}
        <p className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-paper/90 px-3 py-1 text-xs font-semibold">
          {selectedPart ? `Editing: ${selectedPart.name}` : "Click a piece to move it"}
        </p>
      </div>
    </div>
  );
}

function ToolButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-full border-2 border-ink/20 px-3 py-1 font-semibold transition-colors hover:border-ink disabled:opacity-35 disabled:hover:border-ink/20"
    />
  );
}

/** Points the camera at all pieces on mount and whenever `tick` changes. */
function Framer({ geometry, product, tick }: { geometry: ProductGeometry; product: Product; tick: number }) {
  const { camera, controls, size } = useThree();
  const ready = size.width > 0 && size.height > 0;
  useLayoutEffect(() => {
    if (!ready) return;
    const { box, radius } = layoutProduct(geometry, { parts: product.parts, layout: "assembled" }, { center: false });
    const center = box.getCenter(new THREE.Vector3());
    const dist = fitDistance(Math.max(radius, 10), FOV, size.width / size.height, 1.3);
    camera.position.copy(center).addScaledVector(new THREE.Vector3(0.6, 0.55, 1).normalize(), dist);
    camera.lookAt(center);
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    orbit?.target?.copy(center);
    orbit?.update?.();
    // Only reframe on load and on request — not while the pieces are being moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, tick, controls, ready]);
  return null;
}

function Piece({
  geometry,
  center,
  transform,
  filamentId,
  selected,
  mode,
  snap,
  onSelect,
  onCommit,
  onDragStart,
  onDragEnd,
}: {
  geometry: THREE.BufferGeometry;
  center: THREE.Vector3;
  transform: PartTransform | undefined;
  filamentId: string;
  selected: boolean;
  mode: Mode;
  snap: boolean;
  onSelect: () => void;
  onCommit: (t: PartTransform) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const catalog = useCatalog();
  // State (not a ref) so TransformControls re-renders once the group exists.
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const tKey = JSON.stringify(transform ?? null);

  // Place the group imperatively so React re-renders never fight the gizmo.
  useLayoutEffect(() => {
    const g = obj;
    if (!g) return;
    const t = transform ?? { position: [0, 0, 0], rotation: [0, 0, 0] };
    g.position.set(center.x + t.position[0], center.y + t.position[1], center.z + t.position[2]);
    g.rotation.set(...t.rotation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tKey, center, obj]);

  useLayoutEffect(() => {
    const f = getFilament(catalog, filamentId);
    if (material.current && f) applyFilament(material.current, f);
  }, [catalog, filamentId]);

  useEffect(() => {
    if (material.current) {
      material.current.emissive.setRGB(1, 1, 1);
      material.current.emissiveIntensity = selected ? 0.12 : 0;
    }
  }, [selected]);

  function commit() {
    const g = obj;
    if (!g) return;
    const step = snap ? 0.5 : 0.01;
    onCommit({
      position: [round(g.position.x - center.x, step), round(g.position.y - center.y, step), round(g.position.z - center.z, step)],
      rotation: [g.rotation.x, g.rotation.y, g.rotation.z].map((r) => round(r, 1e-4)) as PartTransform["rotation"],
    });
  }

  return (
    <>
      <group ref={setObj}>
        <mesh
          geometry={geometry}
          position={[-center.x, -center.y, -center.z]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (e.delta > 4) return;
            e.stopPropagation();
            onSelect();
          }}
        >
          <meshPhysicalMaterial ref={material} />
        </mesh>
      </group>
      {selected && obj && (
        <TransformControls
          object={obj}
          mode={mode}
          size={1.25}
          translationSnap={snap ? 1 : null}
          rotationSnap={snap ? THREE.MathUtils.degToRad(15) : null}
          onMouseDown={onDragStart}
          onMouseUp={() => {
            commit();
            onDragEnd();
          }}
        />
      )}
    </>
  );
}
