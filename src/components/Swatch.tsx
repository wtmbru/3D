import type { Filament } from "@/lib/types";

/** CSS background that hints at the finish: silk shimmer, sparkle flecks, translucency. */
export function swatchBackground(f: Filament): React.CSSProperties {
  switch (f.finish) {
    case "silk":
      return { background: `linear-gradient(135deg, ${f.hex} 0%, ${f.hex2 ?? f.hex} 45%, ${f.hex} 70%, ${f.hex2 ?? f.hex} 100%)` };
    case "sparkle":
      return {
        backgroundColor: f.hex,
        backgroundImage:
          "radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, #d9c8ff 0 1px, transparent 1.5px), radial-gradient(circle at 40% 80%, #fff 0 0.8px, transparent 1.3px), radial-gradient(circle at 80% 20%, #fff 0 0.8px, transparent 1.3px)",
      };
    case "translucent":
      return { background: `linear-gradient(135deg, ${f.hex}cc, ${f.hex}66)` };
    case "matte":
    case "basic":
    default:
      return {
        backgroundColor: f.hex,
        backgroundImage:
          f.finish === "basic"
            ? "linear-gradient(150deg, rgba(255,255,255,.4) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,.08) 100%)"
            : undefined,
      };
  }
}

export function SwatchDot({ filament, size = 20, className = "" }: { filament: Filament; size?: number; className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full border-2 border-ink ${className}`}
      style={{ width: size, height: size, ...swatchBackground(filament) }}
      title={filament.name}
    />
  );
}
