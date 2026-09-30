"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitRequest } from "@/app/(store)/custom/actions";
import { DELIVERY_METHODS, type DeliveryMethod, type DeliverySettings } from "@/lib/delivery";
import { formatPrice } from "@/lib/pricing";
import { parseLink } from "@/lib/requests";
import { useHydrated } from "@/lib/useHydrated";
import { ColorPicker } from "./ColorPicker";

const steps = [
  { n: "1", title: "Send us the link", body: "Paste the page of the print you found, from MakerWorld or anywhere else.", color: "bg-sun" },
  { n: "2", title: "Tell us your colors", body: "Say what colors and details you want, and how many.", color: "bg-mint" },
  { n: "3", title: "We reply with a price", body: "We check the model and send you a quote. No obligation.", color: "bg-bubble" },
];

export function CustomRequestForm({ delivery: deliverySettings }: { delivery: DeliverySettings }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [colorIds, setColorIds] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<DeliveryMethod>("pickup");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = useHydrated();
  const parsed = link.trim() ? parseLink(link) : null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await submitRequest({
        link,
        colorIds,
        delivery,
        message: String(form.get("message") ?? ""),
        quantity: Number(form.get("quantity") ?? 1),
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        website: String(form.get("website") ?? ""),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/request/${res.id}`);
    });
  }

  return (
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_320px]">
      <form method="post" onSubmit={submit} className="chunky space-y-8 rounded-[var(--radius-blob)] bg-paper p-6 sm:p-8">
        <section>
          <h2 className="font-display text-2xl font-extrabold">The print</h2>
          <label className="mt-4 block">
            <span className="admin-label">Link to the print</span>
            <input
              name="link"
              inputMode="url"
              autoComplete="off"
              required
              className="admin-input"
              placeholder="https://makerworld.com/en/models/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            {link.trim() && !parsed && <span className="admin-hint text-tomato">That doesn&apos;t look like a web link yet.</span>}
            {parsed && (
              <span className="admin-hint">
                {parsed.isMakerWorld ? "✓ MakerWorld link" : `Link to ${parsed.host}`}
              </span>
            )}
          </label>
          <ColorPicker value={colorIds} onChange={setColorIds} />
          <label className="mt-4 block">
            <span className="admin-label">What would you like?</span>
            <textarea
              name="message"
              required
              rows={5}
              maxLength={3000}
              className="admin-input"
              placeholder="Which color goes where, any size changes, when you need it, anything else…"
            />
          </label>
          <label className="mt-4 block max-w-40">
            <span className="admin-label">How many?</span>
            <input name="quantity" type="number" min={1} max={500} defaultValue={1} required className="admin-input" />
          </label>
          <fieldset className="mt-4">
            <legend className="admin-label">How would you like to get it?</legend>
            <div className="mt-1 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Pickup or shipping">
              {DELIVERY_METHODS.map((m) => {
                const on = delivery === m.id;
                return (
                  <label
                    key={m.id}
                    className={`focus-within:ring-sky cursor-pointer rounded-2xl border-2 p-3 text-center transition-transform hover:-translate-y-0.5 focus-within:ring-[3px] ${
                      on ? "border-ink bg-sun shadow-[var(--shadow-pop-sm)]" : "border-ink/20 bg-paper"
                    }`}
                  >
                    <input type="radio" name="delivery" value={m.id} checked={on} onChange={() => setDelivery(m.id)} className="sr-only" />
                    <span className="block font-display font-extrabold">{m.label}</span>
                    <span className="block text-xs text-ink-soft">
                      {m.id === "pickup" ? "Free" : deliverySettings.shippingFee > 0 ? `+${formatPrice(deliverySettings.shippingFee)} shipping` : "Free shipping"}
                    </span>
                  </label>
                );
              })}
            </div>
            <span className="admin-hint">
              {delivery === "shipping" ? "We'll ask for your address once you accept the quote." : deliverySettings.pickupNote || "We'll arrange a pickup time and place with you."}
            </span>
          </fieldset>
        </section>

        <section>
          <h2 className="font-display text-2xl font-extrabold">How can we reach you?</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="admin-label">Name</span>
              <input name="name" autoComplete="name" required className="admin-input" />
            </label>
            <label className="block">
              <span className="admin-label">Email</span>
              <input name="email" type="email" autoComplete="email" required className="admin-input" />
            </label>
            <label className="block">
              <span className="admin-label">Phone</span>
              <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required className="admin-input" />
            </label>
          </div>
          {/* Honeypot: invisible to people, tempting to bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold">
            {error}
          </p>
        )}
        <div>
          <button type="submit" className="btn btn-primary" disabled={pending || !ready}>
            {pending ? "Sending…" : "Send my request"}
          </button>
          <p className="mt-3 text-sm text-ink-soft">
            We only print models we&apos;re allowed to sell. If a print isn&apos;t one we can make, we&apos;ll let you know.
          </p>
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-24" aria-label="How it works">
        {steps.map((s) => (
          <div key={s.n} className="chunky flex gap-4 rounded-[var(--radius-blob)] bg-paper p-5">
            <span className={`chunky grid h-10 w-10 shrink-0 place-items-center rounded-2xl font-display text-xl font-extrabold ${s.color}`}>{s.n}</span>
            <div>
              <h3 className="font-display font-extrabold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
