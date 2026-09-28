"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ColorConfig, MaterialFamily } from "./types";

export interface CartItem {
  /** Same product + material + colors → same line. */
  key: string;
  slug: string;
  family: MaterialFamily;
  config: ColorConfig;
  qty: number;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export function cartKey(slug: string, family: MaterialFamily, config: ColorConfig): string {
  const colors = Object.keys(config)
    .sort()
    .map((k) => `${k}=${config[k]}`)
    .join("&");
  return `${slug}|${family}|${colors}`;
}

export const MAX_QTY = 20;

/**
 * Cart lives in localStorage for now. Prices aren't stored — they're
 * recomputed from the catalog so they can't go stale (or be tampered with).
 */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: ({ slug, family, config, qty }) =>
        set((s) => {
          const key = cartKey(slug, family, config);
          const existing = s.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.key === key ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i,
              ),
            };
          }
          return { items: [...s.items, { key, slug, family, config, qty }] };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          items: s.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i)),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "layercake-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydrated in <CartHydrator /> after mount to avoid SSR mismatches.
      skipHydration: true,
    },
  ),
);

export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
