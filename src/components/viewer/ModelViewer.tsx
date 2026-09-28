"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { applyFilament, fitDistance, layoutProduct, loadProductGeometry, type ProductGeometry } from "@/lib/three/models";
import { useCatalog } from "@/components/CatalogProvider";
import { getFilament } from "@/lib/pricing";
import type { ColorConfig, Filament, Product } from "@/lib/types";

interface ModelViewerProps {
  product: Product;
  config: ColorConfig;
  /** Part to flash, e.g. after it's picked in the color panel. */
  activePart?: string | null;
  onPartClick?: (partId: string) => void;
  autoRotate?: boolean;
  /** Let the customer zoom with scroll/pinch. Off for decorative viewers. */
  zoom?: boolean;
  /** Must give the wrapper a size and a position (e.g. "absolute inset-0"). */
  className?: string;
}

const FOV = 32;
const HOVER_GLOW = 0.18;
const FLASH_GLOW = 0.45;

export function ModelViewer({
  product,
  config,
  activePart,
  onPartClick,
  autoRotate = true,
  zoom = true,
  className,
}: ModelViewerProps) {
  const { geometry, failed } = useGeometry(product);
  // Resolve colors out here — context doesn't need to cross into the Canvas.
  const catalog = useCatalog();
  const colors = useMemo(
    () => Object.fromEntries(product.parts.map((p) => [p.id, getFilament(catalog, config[p.id] ?? p.defaultFilament)])),
    [catalog, product, config],
  );

  return (
    <div className={className ?? "relative"}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: FOV, near: 1, far: 5000, position: [120, 100, 180] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
        style={{ touchAction: "none" }}
        aria-label={`3D preview of ${product.name}. Drag to rotate.`}
      >
        <RoomEnv />
        <directionalLight position={[80, 160, 100]} intensity={1.4} />
        {geometry && (
          <Model
            key={product.id}
            product={product}
            geometry={geometry}
            colors={colors}
            activePart={activePart}
            onPartClick={onPartClick}
            autoRotate={autoRotate}
            zoom={zoom}
          />
        )}
      </Canvas>
      {!geometry && !failed && <LoadingLayers />}
      {failed && (
        <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-ink-soft">
          Couldn&apos;t load the 3D model. Try refreshing.
        </div>
      )}
    </div>
  );
}

function useGeometry(product: Product) {
  const [state, setState] = useState<{ id: string; geometry?: ProductGeometry; failed?: boolean }>({
    id: product.id,
  });
  const filesKey = `${product.upAxis ?? "z"}|${product.parts.map((p) => `${p.id}=${p.file}`).join("|")}`;
  useEffect(() => {
    let live = true;
    loadProductGeometry(product).then(
      (geometry) => live && setState({ id: product.id, geometry }),
      () => live && setState({ id: product.id, failed: true }),
    );
    return () => {
      live = false;
    };
    // filesKey covers everything loading depends on; product changes on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, filesKey]);
  // Ignore results that belong to a previous product.
  const current = state.id === product.id;
  return { geometry: current ? state.geometry : undefined, failed: current && !!state.failed };
}

function Model({
  product,
  geometry,
  colors,
  activePart,
  onPartClick,
  autoRotate,
  zoom,
}: {
  product: Product;
  geometry: ProductGeometry;
  colors: Record<string, Filament | undefined>;
  activePart?: string | null;
  onPartClick?: (id: string) => void;
  autoRotate: boolean;
  zoom: boolean;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [userMoved, setUserMoved] = useState(false);
  const { camera, size } = useThree();

  const layout = useMemo(() => layoutProduct(geometry, product), [geometry, product]);
  // Stable center/radius so edits that don't move the model don't reframe the camera.
  const boundsKey = [...layout.box.min.toArray(), ...layout.box.max.toArray()].map((n) => n.toFixed(1)).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const center = useMemo(() => layout.box.getCenter(new THREE.Vector3()), [boundsKey]);
  const radius = layout.radius;
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
  const distance = fitDistance(radius, FOV, aspect);

  // Frame the model when it loads or the canvas resizes (until the customer takes over).
  useLayoutEffect(() => {
    if (userMoved) return;
    const dir = new THREE.Vector3(0.6, 0.45, 1).normalize();
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.lookAt(center);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, distance, camera]);

  useEffect(() => {
    if (!onPartClick) return;
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered, onPartClick]);

  return (
    <>
      <group>
        {product.parts.filter((part) => layout.matrices[part.id]).map((part) => (
          <PartMesh
            key={part.id}
            geometry={geometry.parts[part.id]}
            matrix={layout.matrices[part.id]}
            filament={colors[part.id]}
            hovered={hovered === part.id}
            active={activePart === part.id}
            interactive={!!onPartClick && !part.locked}
            onOver={() => setHovered(part.id)}
            onOut={() => setHovered((h) => (h === part.id ? null : h))}
            onClick={() => onPartClick?.(part.id)}
          />
        ))}
      </group>
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={radius * 4}
        blur={2.4}
        far={radius * 2}
        opacity={0.45}
        color="#1f1640"
      />
      <OrbitControls
        ref={controls}
        makeDefault
        target={center}
        enablePan={false}
        enableZoom={zoom}
        minDistance={distance * 0.45}
        maxDistance={distance * 1.8}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.02}
        autoRotate={autoRotate && !userMoved}
        autoRotateSpeed={1.6}
        onStart={() => setUserMoved(true)}
      />
    </>
  );
}

function PartMesh({
  geometry,
  matrix,
  filament,
  hovered,
  active,
  interactive,
  onOver,
  onOut,
  onClick,
}: {
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  filament: Filament | undefined;
  hovered: boolean;
  active: boolean;
  interactive: boolean;
  onOver: () => void;
  onOut: () => void;
  onClick: () => void;
}) {
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const flash = useRef(0);

  useLayoutEffect(() => {
    if (material.current && filament) applyFilament(material.current, filament);
  }, [filament]);

  // Flash when this part becomes the active slot or changes color.
  useEffect(() => {
    if (active) flash.current = 1;
  }, [active, filament]);

  useFrame((_, dt) => {
    const m = material.current;
    if (!m) return;
    flash.current = Math.max(0, flash.current - dt * 1.6);
    const glow = Math.max(hovered && interactive ? HOVER_GLOW : 0, flash.current * FLASH_GLOW);
    m.emissive.setRGB(1, 1, 1);
    m.emissiveIntensity = glow;
  });

  const handlers = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onOver();
        },
        onPointerOut: () => onOut(),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          // Ignore the click that ends a drag-to-rotate.
          if (e.delta > 4) return;
          e.stopPropagation();
          onClick();
        },
      }
    : {};

  return (
    <mesh geometry={geometry} matrix={matrix} matrixAutoUpdate={false} {...handlers}>
      <meshPhysicalMaterial ref={material} />
    </mesh>
  );
}

/** Neutral studio lighting generated locally (no HDR download). */
export function RoomEnv() {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return texture;
  }, [gl]);
  useEffect(() => () => env.dispose(), [env]);
  return <primitive object={env} attach="environment" />;
}

/** A little "printing…" animation: layers stacking up. */
function LoadingLayers() {
  const colors = ["bg-tomato", "bg-sun", "bg-mint", "bg-sky", "bg-grape"];
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="flex flex-col-reverse items-center gap-1" aria-label="Loading model">
        {colors.map((c, i) => (
          <span
            key={c}
            className={`block h-2.5 rounded-full ${c} animate-pulse`}
            style={{ width: 64 - i * 8, animationDelay: `${i * 120}ms` }}
          />
        ))}
        <span className="sr-only">Loading 3D model…</span>
      </div>
    </div>
  );
}
