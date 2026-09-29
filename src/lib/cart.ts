"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AddonSelection, ColorConfig, MaterialFamily } from "./types";

export interface CartItem {
  /** Same product + option + material + colors + add-ons → same line. */
  key: string;
  slug: string;
  /** Selected option id (products with sizes/shapes). */
  variant?: string;
  family: MaterialFamily;
  config: ColorConfig;
  addons?: AddonSelection;
  qty: number;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const stable = (r: Record<string, string> = {}) =>
  Object.keys(r)
    .sort()
    .map((k) => `${k}=${r[k]}`)
    .join("&");

export function cartKey(item: Omit<CartItem, "key" | "qty">): string {
  return `${item.slug}|${item.variant ?? ""}|${item.family}|${stable(item.config)}|${stable(item.addons)}`;
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
      add: ({ qty, ...design }) =>
        set((s) => {
          const key = cartKey(design);
          const existing = s.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.key === key ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i,
              ),
            };
          }
          return { items: [...s.items, { key, ...design, qty }] };
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
