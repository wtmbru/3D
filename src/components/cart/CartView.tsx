"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useCatalog } from "@/components/CatalogProvider";
import { ProductThumb } from "@/components/ProductThumb";
import { SwatchDot } from "@/components/Swatch";
import { MAX_QTY, useCart, type CartItem } from "@/lib/cart";
import { designHref } from "@/lib/config";
import { formatPrice, getFilament, quote } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { describeAddons, findVariant, hasOptions, resolveVariant, variantsOf } from "@/lib/variants";

function useHydrated() {
  return useSyncExternalStore(
    (cb) => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}

export function CartView({ products }: { products: Product[] }) {
  const catalog = useCatalog();
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);

  // Drop lines whose product (or chosen option) was removed or unpublished.
  const lines = items
    .map((item) => {
      const full = products.find((p) => p.slug === item.slug);
      if (!full) return null;
      if (item.variant && !variantsOf(full).some((v) => v.id === item.variant)) return null;
      const product = resolveVariant(full, item.variant);
      return { item, full, product, unit: quote(catalog, product, item.family, item.config, item.addons).unit };
    })
    .filter((l) => l !== null);

  if (!hydrated) return <div className="mt-10 h-40 animate-pulse rounded-3xl bg-cream-deep" />;

  if (lines.length === 0) {
    return (
      <div className="chunky layer-lines mt-10 rounded-[36px] bg-sun-soft px-6 py-16 text-center">
        <p className="text-5xl" aria-hidden="true">🛒</p>
        <h2 className="mt-4 font-display text-3xl font-extrabold">Your cart is empty</h2>
        <p className="mt-2 text-ink-soft">Nothing on the build plate yet. Go design something!</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Browse the shop
        </Link>
      </div>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unit * l.item.qty, 0);
  const count = lines.reduce((n, l) => n + l.item.qty, 0);

  return (
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="space-y-4">
        {lines.map(({ item, full, product, unit }, i) => (
          <CartLine key={item.key} item={item} full={full} product={product} unit={unit} index={i} />
        ))}
      </ul>

      <aside className="chunky rounded-[var(--radius-blob)] bg-paper p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-extrabold">Summary</h2>
        <dl className="mt-4 space-y-2">
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              Subtotal ({count} {count === 1 ? "item" : "items"})
            </dt>
            <dd className="font-semibold tabular-nums">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Shipping</dt>
            <dd className="text-ink-soft">Calculated at checkout</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t-2 border-dashed border-ink/20 pt-4">
          <span className="font-display text-lg font-bold">Total</span>
          <span className="font-display text-3xl font-extrabold tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <button type="button" className="btn btn-primary mt-6 w-full" disabled>
          Checkout coming soon
        </button>
        <p className="mt-3 text-center text-xs text-ink-soft">
          Every item is printed to order and ships in a few days.
        </p>
      </aside>
    </div>
  );
}

const tiles = ["bg-sky-soft", "bg-mint-soft", "bg-bubble-soft", "bg-sun-soft"];

function CartLine({
  item,
  full,
  product,
  unit,
  index,
}: {
  item: CartItem;
  full: Product;
  /** The chosen option, resolved. */
  product: Product;
  unit: number;
  index: number;
}) {
  const catalog = useCatalog();
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const href = designHref(full, {
    variantId: findVariant(full, item.variant).id,
    family: item.family,
    config: item.config,
    addons: item.addons ?? {},
  });
  const extras = describeAddons(full, item.addons ?? {});

  return (
    <li className="chunky flex flex-col gap-4 rounded-[var(--radius-blob)] bg-paper p-4 sm:flex-row">
      <Link
        href={href}
        className={`layer-lines relative aspect-square w-full shrink-0 rounded-2xl border-2 border-ink sm:w-36 ${tiles[index % tiles.length]}`}
      >
        <ProductThumb product={product} config={item.config} preferPhoto={false} className="absolute inset-2" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-extrabold">{product.name}</h3>
            <p className="text-sm text-ink-soft">
              {hasOptions(full) && <span className="font-semibold text-ink">{findVariant(full, item.variant).name} · </span>}
              {item.family}
              {extras.length > 0 && ` · ${extras.join(" · ")}`}
            </p>
          </div>
          <p className="font-display text-xl font-extrabold tabular-nums">{formatPrice(unit * item.qty)}</p>
        </div>
        <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
          {product.parts.map((p) => {
            const f = getFilament(catalog, item.config[p.id]);
            return (
              <li key={p.id} className="flex items-center gap-2">
                {f && <SwatchDot filament={f} size={16} className="border-[1.5px]" />}
                <span className="text-ink-soft">{p.name}:</span>
                <span className="truncate font-semibold">{f?.name ?? "—"}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
          <div className="flex items-center rounded-full border-2 border-ink">
            <button type="button" className="focus-ring rounded-l-full px-3 py-1 font-bold disabled:opacity-40" onClick={() => setQty(item.key, item.qty - 1)} disabled={item.qty <= 1} aria-label="Decrease quantity">
              −
            </button>
            <span className="w-7 text-center font-bold tabular-nums">{item.qty}</span>
            <button type="button" className="focus-ring rounded-r-full px-3 py-1 font-bold disabled:opacity-40" onClick={() => setQty(item.key, item.qty + 1)} disabled={item.qty >= MAX_QTY} aria-label="Increase quantity">
              +
            </button>
          </div>
          <span className="text-sm text-ink-soft tabular-nums">{formatPrice(unit)} each</span>
          <span className="flex-1" />
          <Link href={href} className="text-sm font-semibold underline decoration-2 underline-offset-4">
            Edit colors
          </Link>
          <button type="button" onClick={() => remove(item.key)} className="text-sm font-semibold text-tomato underline decoration-2 underline-offset-4">
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
