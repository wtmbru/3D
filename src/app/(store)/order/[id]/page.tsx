import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { swatchBackground } from "@/components/Swatch";
import { finishLabels } from "@/data/constants";
import { addressLines } from "@/lib/delivery";
import { orderLabel, ORDER_STATUSES, PAYMENT_STATUSES, paymentLabel, progressSteps, type PaymentMethod } from "@/lib/orders";
import { formatPrice, getFilament } from "@/lib/pricing";
import { getCatalog } from "@/lib/server/catalog";
import { getOrderById, getPaymentSettings } from "@/lib/server/orders";
import { getDeliverySettings } from "@/lib/server/settings";
import { site } from "@/config/site";

// Anyone with the link (an unguessable id) can see this. Keep it out of search results.
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

export default async function OrderPage(props: PageProps<"/order/[id]">) {
  const { id } = await props.params;
  const [order, payments, catalog, deliverySettings] = await Promise.all([getOrderById(id), getPaymentSettings(), getCatalog(), getDeliverySettings()]);
  if (!order) notFound();

  const handle = payments[order.payment as PaymentMethod];
  const steps = progressSteps(order);
  const cancelled = order.status === "cancelled";
  const status = ORDER_STATUSES.find((s) => s.id === order.status)!;
  const pay = PAYMENT_STATUSES.find((s) => s.id === order.paymentStatus)!;
  const firstName = order.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Order {orderLabel(order.number)}</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Thanks, {firstName}! 🎉</h1>
      <p className="mt-3 text-lg text-ink-soft">
        We got your order. Save this page to check on its progress any time.
      </p>

      {order.paymentStatus === "unpaid" && !cancelled && (
        <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-sun-soft p-6">
          <h2 className="font-display text-2xl font-extrabold">
            Next: send {formatPrice(order.total)} with {paymentLabel(order.payment)}
          </h2>
          {handle ? (
            <>
              <p className="mt-3 text-sm font-semibold text-ink-soft">{paymentLabel(order.payment)}</p>
              <p className="mt-0.5 break-all font-display text-3xl font-extrabold">{handle}</p>
              <p className="mt-3">
                Please put <strong>{orderLabel(order.number)}</strong> in the note so we can match your payment.
              </p>
            </>
          ) : (
            <p className="mt-3">
              We&apos;ll contact you at <strong>{order.email}</strong> or <strong>{order.phone}</strong> with payment details shortly.
            </p>
          )}
          {payments.note && <p className="mt-3 text-sm text-ink-soft">{payments.note}</p>}
          <p className="mt-3 text-sm text-ink-soft">We&apos;ll mark your order as paid once we&apos;ve received it.</p>
        </section>
      )}

      <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-paper p-6" aria-label="Delivery">
        <h2 className="font-display text-2xl font-extrabold">{order.delivery === "shipping" ? "Shipping to" : "Local pickup"}</h2>
        {order.delivery === "shipping" && order.shippingAddress ? (
          <>
            <address className="mt-3 not-italic">
              <span className="block font-semibold">{order.name}</span>
              {addressLines(order.shippingAddress).map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
            <p className="mt-3 text-sm text-ink-soft">Wrong address? Reach out at {site.email} as soon as you can.</p>
          </>
        ) : (
          <p className="mt-2">{deliverySettings.pickupNote || "We'll message you to arrange a pickup time and place."}</p>
        )}
      </section>

      <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-paper p-6" aria-label="Order progress">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 font-display text-2xl font-extrabold">Progress</h2>
          <span className={`chip text-xs ${pay.tone}`}>{pay.label}</span>
          <span className={`chip text-xs ${status.tone}`}>{status.label}</span>
        </div>
        {cancelled ? (
          <p className="mt-4 rounded-2xl bg-cream-deep px-4 py-3 text-sm font-semibold">
            This order was cancelled. Questions? Reach out at {site.email}.
          </p>
        ) : (
          <ol className="mt-5 space-y-3">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink text-sm font-extrabold ${
                    s.done ? "bg-mint" : "bg-paper text-ink-faint"
                  }`}
                  aria-hidden="true"
                >
                  {s.done ? "✓" : ""}
                </span>
                <span className={s.done ? "font-semibold" : "text-ink-soft"}>
                  {s.label}
                  <span className="sr-only">{s.done ? " (done)" : " (not yet)"}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-paper p-6">
        <h2 className="font-display text-2xl font-extrabold">What you ordered</h2>
        <ul className="mt-4 divide-y-2 divide-dashed divide-ink/15">
          {order.items.map((item) => (
            <li key={item.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">
                    {item.qty > 1 && <span className="text-ink-soft">{item.qty} × </span>}
                    {item.name}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {[item.variantName, item.family, ...item.addons].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="font-display font-bold tabular-nums">{formatPrice(item.unitPrice * item.qty)}</p>
              </div>
              <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {item.parts.map((p) => {
                  const f = getFilament(catalog, p.filamentId);
                  return (
                    <li key={p.id} className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border-[1.5px] border-ink"
                        style={f ? swatchBackground(f) : { background: p.hex }}
                      />
                      <span className="text-ink-soft">{p.name}:</span>
                      <span className="truncate font-semibold">
                        {p.filamentName} · {finishLabels[p.finish]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        {order.shippingFee ? (
          <div className="mt-4 flex items-baseline justify-between text-sm">
            <span className="font-semibold text-ink-soft">Shipping</span>
            <span className="font-semibold tabular-nums">{formatPrice(order.shippingFee)}</span>
          </div>
        ) : null}
        <div className="mt-5 flex items-baseline justify-between border-t-2 border-dashed border-ink/20 pt-4">
          <span className="font-display text-lg font-bold">Total</span>
          <span className="font-display text-3xl font-extrabold tabular-nums">{formatPrice(order.total)}</span>
        </div>
      </section>

      <Link href="/shop" className="btn btn-secondary mt-8">
        Keep shopping
      </Link>
    </div>
  );
}
