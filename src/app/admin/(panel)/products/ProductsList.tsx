"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ProductThumb } from "@/components/ProductThumb";
import { categories } from "@/data/constants";
import { formatPrice, startingPrice } from "@/lib/pricing";
import type { Catalog, Product } from "@/lib/types";
import { hasOptions, optionsBadge } from "@/lib/variants";
import { reorderProducts, setHeroProduct } from "../../actions";
import { Notice, useNotice } from "../ui";

export function ProductsList({
  products,
  catalog,
  chosenHeroId,
  autoHeroId,
}: {
  products: Product[];
  catalog: Catalog;
  /** The product picked with the star, if any (and still published). */
  chosenHeroId: string | null;
  /** What the homepage shows when nothing is picked. */
  autoHeroId: string | null;
}) {
  const [items, setItems] = useState(products);
  const [hero, setHero] = useState(chosenHeroId);
  const [dragging, setDragging] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();
  const [pending, start] = useTransition();
  const dragId = useRef<string | null>(null);
  // The order the server has, to skip saving when nothing changed.
  const [savedKey, setSavedKey] = useState(products.map((p) => p.id).join());

  // A product was added or removed elsewhere: start from the server's list again.
  const serverKey = products.map((p) => p.id).sort().join();
  const [seenKey, setSeenKey] = useState(serverKey);
  if (serverKey !== seenKey) {
    setSeenKey(serverKey);
    setItems(products);
    setSavedKey(products.map((p) => p.id).join());
  }

  const shownHeroId = hero ?? autoHeroId;
  const heroProduct = items.find((p) => p.id === shownHeroId);

  function move(list: Product[], from: number, to: number) {
    const next = [...list];
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
  }

  function save(order: Product[]) {
    const key = order.map((p) => p.id).join();
    if (key === savedKey) return;
    start(async () => {
      const res = await reorderProducts(order.map((p) => p.id));
      if (res.ok) {
        setSavedKey(key);
        setNotice({ kind: "ok", text: "Order saved." });
      } else {
        setNotice({ kind: "error", text: res.error });
      }
    });
  }

  function nudge(id: string, dir: -1 | 1) {
    const from = items.findIndex((p) => p.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = move(items, from, to);
    setItems(next);
    save(next);
  }

  function toggleHero(id: string) {
    const previous = hero;
    const next = hero === id ? null : id;
    setHero(next);
    start(async () => {
      const res = await setHeroProduct(next);
      if (res.ok) {
        setNotice({ kind: "ok", text: next ? "Now showing at the top of the homepage." : "Homepage is back to picking automatically." });
      } else {
        setHero(previous);
        setNotice({ kind: "error", text: res.error });
      }
    });
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
        <span aria-hidden="true">⭐</span>
        <p className="min-w-0 flex-1">
          {heroProduct ? (
            <>
              <strong>Top of the homepage:</strong> {heroProduct.name}
              {hero ? "" : " (picked automatically)"}
            </>
          ) : (
            "Publish a product to show it at the top of the homepage."
          )}
        </p>
        {hero && (
          <button type="button" className="font-semibold underline decoration-2 underline-offset-4" onClick={() => toggleHero(hero)}>
            Go back to automatic
          </button>
        )}
      </div>

      <div className="mt-3 min-h-10">
        <Notice notice={notice} />
      </div>

      <ul className="overflow-hidden rounded-3xl border-2 border-ink bg-paper" aria-label="Products, in the order customers see them">
        {items.map((p, i) => {
          const isHero = p.id === shownHeroId;
          const chosen = p.id === hero;
          const options = optionsBadge(p);
          return (
            <li
              key={p.id}
              draggable
              onDragStart={(e) => {
                dragId.current = p.id;
                setDragging(p.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", p.id); // Firefox needs data to start a drag
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const from = items.findIndex((x) => x.id === dragId.current);
                if (from >= 0 && from !== i) setItems(move(items, from, i));
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={() => {
                dragId.current = null;
                setDragging(null);
                save(items);
              }}
              className={`flex items-center gap-2 border-b-2 border-ink/10 px-2 py-2 transition-colors last:border-b-0 sm:gap-3 sm:px-3 ${
                dragging === p.id ? "bg-sky-soft opacity-70" : "bg-paper"
              }`}
            >
              <span className="hidden w-5 shrink-0 cursor-grab text-center text-lg leading-none text-ink-faint select-none active:cursor-grabbing sm:block" aria-hidden="true" title="Drag to reorder">
                ⠿
              </span>
              <div className="flex shrink-0 flex-col">
                <button type="button" aria-label={`Move ${p.name} up`} disabled={i === 0 || pending} onClick={() => nudge(p.id, -1)} className="px-1 leading-none disabled:opacity-20">
                  ▲
                </button>
                <button type="button" aria-label={`Move ${p.name} down`} disabled={i === items.length - 1 || pending} onClick={() => nudge(p.id, 1)} className="px-1 leading-none disabled:opacity-20">
                  ▼
                </button>
              </div>
              <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-ink-faint">{i + 1}</span>

              <Link href={`/admin/products/${p.id}`} draggable={false} className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 hover:bg-cream">
                <ProductThumb product={p} className="h-14 w-14 shrink-0 rounded-2xl bg-sky-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{p.name}</p>
                  <p className="truncate text-sm text-ink-soft">
                    {categories.find((c) => c.id === p.category)?.label} · {p.parts.length} {p.parts.length === 1 ? "part" : "parts"}
                    {hasOptions(p) && ` · ${options}`}
                  </p>
                </div>
                <span className="hidden font-display font-bold tabular-nums sm:block">{formatPrice(startingPrice(catalog, p))}</span>
                <span className={`chip text-xs ${p.published ? "bg-mint-soft" : "bg-sun-soft"}`}>{p.published ? "Live" : "Draft"}</span>
              </Link>

              <button
                type="button"
                aria-pressed={chosen}
                aria-label={chosen ? `${p.name} is at the top of the homepage. Click to stop.` : `Show ${p.name} at the top of the homepage`}
                title={p.published ? (chosen ? "Top of the homepage. Click to stop." : isHero ? "Shown at the top automatically. Click to lock it in." : "Show at the top of the homepage") : "Publish it first to show it on the homepage"}
                disabled={!p.published || pending}
                onClick={() => toggleHero(p.id)}
                className={`focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-xl leading-none transition-transform hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 ${
                  chosen ? "border-ink bg-sun" : isHero ? "border-ink/40 bg-sun-soft" : "border-ink/20 bg-paper"
                }`}
              >
                <span aria-hidden="true">{chosen || isHero ? "★" : "☆"}</span>
              </button>
            </li>
          );
        })}
        {items.length === 0 && <li className="p-10 text-center text-ink-soft">No products yet. Add your first design!</li>}
      </ul>
    </div>
  );
}
