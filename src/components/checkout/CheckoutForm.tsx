"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrder } from "@/app/(store)/checkout/actions";
import { useCatalog } from "@/components/CatalogProvider";
import { SwatchDot } from "@/components/Swatch";
import { useCart, useCartHydrated } from "@/lib/cart";
import { resolveCartLines } from "@/lib/cartLines";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders";
import { formatPrice, getFilament } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { describeAddons, findVariant, hasOptions } from "@/lib/variants";

const paymentBlurbs: Record<PaymentMethod, string> = {
  zelle: "Bank transfer, no fees",
  venmo: "Send to our Venmo",
  cashapp: "Send to our Cash App",
};

export function CheckoutForm({ products }: { products: Product[] }) {
  const catalog = useCatalog();
  const router = useRouter();
  const hydrated = useCartHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lines = resolveCartLines(catalog, products, items);
  const total = lines.reduce((sum, l) => sum + l.unit * l.item.qty, 0);

  if (!hydrated) return <div className="mt-10 h-64 animate-pulse rounded-3xl bg-cream-deep" />;

  if (lines.length === 0) {
    return (
      <div className="chunky layer-lines mt-10 rounded-[36px] bg-sun-soft px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-extrabold">Your cart is empty</h2>
        <p className="mt-2 text-ink-soft">Add something to your cart, then come back to place your order.</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Browse the shop
        </Link>
      </div>
    );
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await placeOrder({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        payment: payment as PaymentMethod,
        notes: String(form.get("notes") ?? ""),
        website: String(form.get("website") ?? ""),
        // Only the design goes to the server. It works out the prices itself.
        items: lines.map(({ item }) => ({
          slug: item.slug,
          variant: item.variant,
          family: item.family,
          config: item.config,
          addons: item.addons,
          qty: item.qty,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      clear();
      router.push(`/order/${res.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section className="chunky rounded-[var(--radius-blob)] bg-paper p-6">
          <h2 className="font-display text-2xl font-extrabold">Your details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" autoComplete="name" required className="sm:col-span-2" />
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <Field label="Phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required />
          </div>
          <p className="mt-3 text-sm text-ink-soft">We&apos;ll only use these to confirm your order and reach you about it.</p>
          {/* Honeypot: invisible to people, tempting to bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        </section>

        <fieldset className="chunky rounded-[var(--radius-blob)] bg-paper p-6">
          <legend className="sr-only">How will you pay?</legend>
          <h2 className="font-display text-2xl font-extrabold" aria-hidden="true">
            How will you pay?
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Payment method">
            {PAYMENT_METHODS.map((m) => {
              const on = payment === m.id;
              return (
                <label
                  key={m.id}
                  className={`focus-within:ring-sky cursor-pointer rounded-2xl border-2 p-4 text-center transition-transform hover:-translate-y-0.5 focus-within:ring-[3px] ${
                    on ? "border-ink bg-sun shadow-[var(--shadow-pop-sm)]" : "border-ink/20 bg-paper"
                  }`}
                >
                  <input type="radio" name="payment" value={m.id} checked={on} onChange={() => setPayment(m.id)} className="sr-only" required />
                  <span className="block font-display text-lg font-extrabold">{m.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">{paymentBlurbs[m.id]}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            You won&apos;t pay online. After you place your order, we&apos;ll show you how to send your payment.
          </p>
        </fieldset>

        <section className="chunky rounded-[var(--radius-blob)] bg-paper p-6">
          <label htmlFor="notes" className="font-display text-2xl font-extrabold">
            Anything else? <span className="text-base font-semibold text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            maxLength={500}
            rows={3}
            placeholder="Pickup or delivery details, gift notes, questions…"
            className="admin-input mt-4"
          />
        </section>
      </div>

      <aside className="chunky rounded-[var(--radius-blob)] bg-paper p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-extrabold">Your order</h2>
        <ul className="mt-4 divide-y-2 divide-dashed divide-ink/15">
          {lines.map(({ item, full, product, unit }) => {
            const extras = describeAddons(full, item.addons ?? {});
            return (
              <li key={item.key} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold">
                      {item.qty > 1 && <span className="text-ink-soft">{item.qty} × </span>}
                      {full.name}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {[hasOptions(full) ? findVariant(full, item.variant).name : null, item.family, ...extras].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {product.parts.map((p) => {
                        const f = getFilament(catalog, item.config[p.id]);
                        return f && <SwatchDot key={p.id} filament={f} size={16} className="border-[1.5px]" />;
                      })}
                    </div>
                  </div>
                  <p className="font-display font-bold tabular-nums">{formatPrice(unit * item.qty)}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t-2 border-dashed border-ink/20 pt-4">
          <span className="font-display text-lg font-bold">Total</span>
          <span className="font-display text-3xl font-extrabold tabular-nums">{formatPrice(total)}</span>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-5 w-full" disabled={pending}>
          {pending ? "Placing your order…" : `Place order · ${formatPrice(total)}`}
        </button>
        <Link href="/cart" className="mt-3 block text-center text-sm font-semibold underline decoration-2 underline-offset-4">
          ← Back to cart
        </Link>
      </aside>
    </form>
  );
}

function Field({
  label,
  name,
  className = "",
  ...rest
}: { label: string; name: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="admin-label">{label}</span>
      <input name={name} className="admin-input" {...rest} />
    </label>
  );
}
