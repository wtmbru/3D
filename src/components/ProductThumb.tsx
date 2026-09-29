"use client";

import { useEffect, useState } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { defaultConfig } from "@/lib/pricing";
import { withPosition } from "@/lib/ui";
import { renderThumbnail } from "@/lib/three/thumbnails";
import type { ColorConfig, Product } from "@/lib/types";

/**
 * Product image: a real photo when she's uploaded one, otherwise a 3D render
 * of the model in the given colors.
 *
 * `className` sizes and positions the box. A photo fills the whole box (cropped
 * to cover, since photos are any shape); a 3D render is fitted inside it, with
 * `renderInset` as breathing room around the model. Keeping that rule in here
 * means no caller can end up with a letterboxed or shifted photo.
 */
export function ProductThumb({
  product,
  config,
  className = "",
  renderInset = "inset-0",
  preferPhoto = true,
}: {
  product: Product;
  config?: ColorConfig;
  className?: string;
  /** Tailwind inset class for the 3D render's margin, e.g. "inset-[8%]". */
  renderInset?: string;
  preferPhoto?: boolean;
}) {
  const photo = preferPhoto ? product.photos?.[0] : undefined;
  const catalog = useCatalog();
  const [src, setSrc] = useState<string | null>(null);
  const configKey = JSON.stringify(config ?? null);

  useEffect(() => {
    if (photo) return;
    let live = true;
    renderThumbnail(catalog, product, config ?? defaultConfig(product))
      .then((url) => live && setSrc(url))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // configKey stands in for config (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, product, configKey, photo]);

  return (
    <div className={`overflow-hidden ${withPosition(className)}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={product.name} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : src ? (
        <div className={`absolute ${renderInset}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={product.name} className="h-full w-full object-contain" draggable={false} />
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-1/2 w-1/2 animate-pulse rounded-full bg-ink/5" />
        </div>
      )}
    </div>
  );
}
