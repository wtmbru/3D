"use client";

import { useEffect, useState } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { defaultConfig } from "@/lib/pricing";
import { renderThumbnail } from "@/lib/three/thumbnails";
import type { ColorConfig, Product } from "@/lib/types";

/**
 * Product image: a real photo when she's uploaded one, otherwise a 3D render
 * of the model in the given colors.
 */
export function ProductThumb({
  product,
  config,
  className = "",
  preferPhoto = true,
}: {
  product: Product;
  config?: ColorConfig;
  className?: string;
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

  const url = photo ?? src;
  return (
    <div className={`relative ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={product.name} className="h-full w-full object-contain" draggable={false} />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-1/2 w-1/2 animate-pulse rounded-full bg-ink/5" />
        </div>
      )}
    </div>
  );
}
