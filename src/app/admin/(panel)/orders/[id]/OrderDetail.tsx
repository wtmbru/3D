"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { ProductThumb } from "@/components/ProductThumb";
import { swatchBackground } from "@/components/Swatch";
import { useCatalog } from "@/components/CatalogProvider";
import { finishLabels } from "@/data/constants";
import { addressText } from "@/lib/delivery";
import {
  ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PIPELINE,
  itemCount,
  orderLabel,
  type ItemStatus,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { defaultTextKind, orderText, TEXT_KINDS, type TextKind } from "@/lib/orderTexts";
import { formatPrice, getFilament } from "@/lib/pricing";
import { smsLink } from "@/lib/sms";
import { useHydrated } from "@/lib/useHydrated";
import type { Product } from "@/lib/types";
import { removeOrder, saveOrderNotes, setOrderItemStatus, setOrderStatus, setPaymentStatus } from "../../../order-actions";
import { Notice, useNotice } from "../../ui";
import { When } from "../badges";

export function OrderDetail({
  order,
  thumbs,
  handle,
  methodLabel,
}: {
  order: Order;
  thumbs: Record<string, Product>;
  handle: string;
  methodLabel: string;
}) {
  const catalog = useCatalog();
  const router = useRouter();
  const [notice, setNotice] = useNotice();
  const [pending, start] = useTransition();
  // Shows a change instantly; it reverts by itself if saving fails.
  const [view, apply] = useOptimistic(order, (o, patch: Partial<Order>) => ({ ...o, ...patch }));
  // What's being typed in the notes box; otherwise it shows the saved note.
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // The text to send: which kind, and her edits (otherwise the ready-made wording).
  const [textKind, setTextKind] = useState<TextKind | null>(null);
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const hydrated = useHydrated();

  function save(patch: Partial<Order>, action: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      apply(patch);
      const res = await action();
      if (!res.ok) setNotice({ kind: "error", text: res.error ?? "Couldn't save that." });
    });
  }

  const setStatus = (status: OrderStatus) => save({ status }, () => setOrderStatus(order.id, status));
  const setPay = (paymentStatus: PaymentStatus) => save({ paymentStatus }, () => setPaymentStatus(order.id, paymentStatus));
  const setItem = (itemId: string, status: ItemStatus) =>
    save({ items: view.items.map((i) => (i.id === itemId ? { ...i, status } : i)) }, () => setOrderItemStatus(order.id, itemId, status));

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked; the text is visible to select by hand.
    }
  }

  const kind = textKind ?? defaultTextKind(view);
  // The customer's page address depends on where this admin is open, so it's only known after loading.
  const textBody =
    textDraft ??
    orderText(kind, view, { trackingUrl: hydrated ? `${window.location.origin}/order/${order.id}` : "", methodLabel, handle: handle || undefined });
  const cancelled = view.status === "cancelled";
  const done = view.items.filter((i) => i.status === "done").length;

  return (
    <div>
      <Link href="/admin/orders" className="text-sm font-semibold text-ink-soft hover:text-ink">
        ← Orders
      </Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Order {orderLabel(order.number)}</h1>
          <p className="mt-1 text-ink-soft">
            Placed <When iso={order.createdAt} /> · {itemCount(order)} {itemCount(order) === 1 ? "item" : "items"} ·{" "}
            <strong className="text-ink">{formatPrice(order.total)}</strong>
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(`${window.location.origin}/order/${order.id}`, "link")}>
          {copied === "link" ? "Link copied!" : "Copy customer's tracking link"}
        </button>
      </div>

      <div className="mt-3 min-h-10">
        <Notice notice={notice} />
      </div>

      <div className="mt-2 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* What to make */}
        <section aria-label="Items" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="admin-h2">What to print</h2>
            <span className="text-sm font-semibold text-ink-soft">
              {done}/{view.items.length} done
            </span>
          </div>
          {view.items.map((item) => {
            const thumb = thumbs[item.id];
            return (
              <article key={item.id} className={`admin-card ${cancelled ? "opacity-60" : ""}`}>
                <div className="flex gap-4">
                  {thumb && (
                    <ProductThumb
                      product={thumb}
                      config={item.config}
                      preferPhoto={false}
                      className="h-24 w-24 shrink-0 rounded-2xl border-2 border-ink bg-sky-soft"
                      renderInset="inset-1.5"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-extrabold">
                          {item.qty > 1 && <span className="text-tomato">{item.qty} × </span>}
                          {item.name}
                        </h3>
                        <p className="text-sm text-ink-soft">
                          {[item.variantName, item.family].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className="font-display text-lg font-bold tabular-nums">{formatPrice(item.unitPrice * item.qty)}</p>
                    </div>
                    {item.addons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.addons.map((a) => (
                          <span key={a} className="chip bg-grape-soft px-2.5 py-0.5 text-xs">
                            + {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {item.parts.map((p) => {
                    const f = getFilament(catalog, p.filamentId);
                    return (
                      <li key={p.id} className="flex items-center gap-2.5 text-sm">
                        <span
                          className="h-6 w-6 shrink-0 rounded-full border-2 border-ink"
                          style={f ? swatchBackground(f) : { background: p.hex }}
                          title={p.hex}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{p.name}</span>
                          <span className="block truncate text-ink-soft">
                            {p.filamentName} · {finishLabels[p.finish]}
                            {p.plate ? ` · Print ${p.plate}` : ""}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-ink/15 pt-3">
                  <span className="mr-1 text-sm font-semibold text-ink-soft">Print progress</span>
                  <Segmented
                    label={`Print progress for ${item.name}`}
                    options={ITEM_STATUSES}
                    value={item.status}
                    onChange={(s) => setItem(item.id, s)}
                    disabled={cancelled}
                  />
                </div>
              </article>
            );
          })}
        </section>

        {/* Tracking + customer */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <section className="admin-card" aria-label="Order progress">
            <h2 className="admin-h2">Progress</h2>
            {cancelled ? (
              <p className="mt-3 rounded-xl bg-cream-deep px-3 py-2 text-sm font-semibold">This order is cancelled.</p>
            ) : (
              <div className="mt-3">
                <Segmented
                  label="Order progress"
                  options={ORDER_STATUSES.filter((s) => PIPELINE.includes(s.id))}
                  value={view.status}
                  onChange={setStatus}
                  wrap
                />
                <p className="mt-2 text-xs text-ink-soft">
                  {ORDER_STATUSES.find((s) => s.id === view.status)?.hint}. Marking prints as started or done moves this along for you.
                </p>
              </div>
            )}
            <div className="mt-3">
              {cancelled ? (
                <button type="button" className="text-sm font-semibold underline decoration-2 underline-offset-4" onClick={() => setStatus("new")}>
                  Reopen order
                </button>
              ) : (
                <button
                  type="button"
                  className="text-sm font-semibold text-tomato underline decoration-2 underline-offset-4"
                  onClick={() => confirm(`Cancel order ${orderLabel(order.number)}? The customer will see it as cancelled.`) && setStatus("cancelled")}
                >
                  Cancel order
                </button>
              )}
            </div>
            {view.completedAt && <p className="mt-2 text-xs text-ink-soft">Completed <When iso={view.completedAt} /></p>}
          </section>

          <section className="admin-card" aria-label="Payment">
            <h2 className="admin-h2">Payment</h2>
            <p className="mt-2 text-sm text-ink-soft">
              <strong className="text-ink">{formatPrice(order.total)}</strong> via <strong className="text-ink">{methodLabel}</strong>
              {handle && <> to {handle}</>}. Customer was asked to include <strong className="text-ink">{orderLabel(order.number)}</strong> in the note.
            </p>
            <div className="mt-3">
              <Segmented label="Payment status" options={PAYMENT_STATUSES} value={view.paymentStatus} onChange={setPay} />
            </div>
            {view.paidAt && view.paymentStatus === "paid" && <p className="mt-2 text-xs text-ink-soft">Paid <When iso={view.paidAt} /></p>}
          </section>

          <section className="admin-card" aria-label="Customer">
            <h2 className="admin-h2">Customer</h2>
            <p className="mt-2 font-display text-lg font-bold">{order.name}</p>
            <ContactRow label="Phone" value={order.phone} href={`tel:${order.phone.replace(/[^\d+]/g, "")}`} copied={copied === "phone"} onCopy={() => copy(order.phone, "phone")} />
            <ContactRow label="Email" value={order.email} href={`mailto:${order.email}`} copied={copied === "email"} onCopy={() => copy(order.email, "email")} />
            {order.notes && (
              <div className="mt-3 rounded-xl bg-cream px-3 py-2 text-sm">
                <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Customer note</p>
                <p className="mt-0.5 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </section>

          <section className="admin-card" aria-label="Delivery">
            <h2 className="admin-h2">{order.delivery === "shipping" ? "Ship to" : "Local pickup"}</h2>
            {order.delivery === "shipping" && order.shippingAddress ? (
              <>
                <address className="mt-2 not-italic">
                  <span className="block font-semibold">{order.name}</span>
                  {addressText(order.shippingAddress)
                    .split("\n")
                    .map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                </address>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-3"
                  onClick={() => copy(`${order.name}\n${addressText(order.shippingAddress!)}`, "address")}
                >
                  {copied === "address" ? "Copied!" : "Copy address"}
                </button>
                {order.shippingFee ? <p className="admin-hint">Customer paid {formatPrice(order.shippingFee)} for shipping (included in the total).</p> : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">The customer will pick this up. Arrange a time and place with them.</p>
            )}
          </section>

          <section className="admin-card" aria-label="Text the customer">
            <h2 className="admin-h2">Text {order.name.split(" ")[0]}</h2>
            <div className="mt-3">
              <Segmented
                label="Message"
                options={TEXT_KINDS}
                value={kind}
                onChange={(k) => {
                  setTextKind(k);
                  setTextDraft(null);
                }}
                wrap
              />
            </div>
            <label className="mt-3 block">
              <span className="sr-only">Message to send</span>
              <textarea className="admin-input min-h-28" maxLength={600} value={textBody} onChange={(e) => setTextDraft(e.target.value)} />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {/* Opens Messages (iPhone, or a Mac signed in to Messages) with the number and text ready to send. */}
              <button type="button" className="btn btn-primary btn-sm" disabled={!hydrated || !textBody.trim()} onClick={() => (window.location.href = smsLink(order.phone, textBody))}>
                Open in Messages
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(textBody, "text")}>
                {copied === "text" ? "Copied!" : "Copy text"}
              </button>
            </div>
            <p className="admin-hint">Opens Messages with {order.phone} and this text ready. Nothing is sent until you press send.</p>
          </section>

          <section className="admin-card" aria-label="Your notes">
            <label htmlFor="admin-notes" className="admin-h2">
              Your notes
            </label>
            <textarea
              id="admin-notes"
              className="admin-input mt-2 min-h-24"
              placeholder="Private notes, e.g. picked up Saturday, reprint the lid…"
              maxLength={4000}
              value={draft ?? view.adminNotes ?? ""}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const text = (draft ?? "").trim();
                if (draft !== null && text !== (view.adminNotes ?? "")) save({ adminNotes: text }, () => saveOrderNotes(order.id, text));
                setDraft(null);
              }}
            />
            <p className="admin-hint">Only you can see this. Saves when you click away.</p>
          </section>

          <button
            type="button"
            disabled={pending}
            className="text-sm font-semibold text-ink-soft underline decoration-2 underline-offset-4 hover:text-tomato"
            onClick={() => {
              if (!confirm(`Delete order ${orderLabel(order.number)} for good? Use this for spam or tests.`)) return;
              start(async () => {
                const res = await removeOrder(order.id);
                if (res.ok) router.push("/admin/orders");
                else setNotice({ kind: "error", text: res.error });
              });
            }}
          >
            Delete this order
          </button>
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  wrap,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  wrap?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      // Wrapped mode is for narrow cards with many options: separate pills in a grid, since one outlined pill can't wrap neatly.
      className={wrap ? "grid grid-cols-2 gap-2" : "inline-flex rounded-full border-2 border-ink p-0.5"}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(o.id)}
            className={`rounded-full px-3 py-1 text-sm font-bold transition-colors disabled:opacity-40 ${
              wrap ? `border-2 border-ink py-1.5 ${on ? "bg-ink text-cream" : "bg-paper hover:bg-cream-deep"}` : on ? "bg-ink text-cream" : "hover:bg-cream-deep"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ContactRow({ label, value, href, copied, onCopy }: { label: string; value: string; href: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-sm">
      <span className="w-12 shrink-0 text-ink-soft">{label}</span>
      <a href={href} className="min-w-0 flex-1 truncate font-semibold underline decoration-2 underline-offset-2">
        {value}
      </a>
      <button type="button" onClick={onCopy} className="chip px-2 py-0 text-xs">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
