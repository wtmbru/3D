import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { swatchBackground } from "@/components/Swatch";
import { site } from "@/config/site";
import { linkHost, REQUEST_STATUSES, requestLabel } from "@/lib/requests";
import { formatPrice } from "@/lib/pricing";
import { QuoteAnswer } from "@/components/custom/QuoteAnswer";
import { getRequestById } from "@/lib/server/requests";

// Anyone with the link (an unguessable id) can see this. Keep it out of search results.
export const metadata: Metadata = { title: "Your custom request", robots: { index: false, follow: false } };

export default async function RequestPage(props: PageProps<"/request/[id]">) {
  const { id } = await props.params;
  const request = await getRequestById(id);
  if (!request) notFound();

  const status = REQUEST_STATUSES.find((s) => s.id === request.status)!;
  const quoted = request.quotePrice !== undefined && request.status !== "new";
  const declined = request.status === "declined";
  const steps = [
    { label: "Request received", done: true },
    { label: "We've looked at it and replied", done: request.status !== "new" },
    { label: "You said yes, so we get printing", done: request.status === "accepted" },
  ];
  const total = quoted ? request.quotePrice! * request.quantity : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Custom request {requestLabel(request.number)}</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Thanks, {request.name.split(" ")[0]}! 🎉</h1>
      <p className="mt-3 text-lg text-ink-soft">
        We got your request. We&apos;ll take a look and reply with a price by phone or email. Save this page to see our reply here too.
      </p>

      {declined ? (
        <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-cream-deep p-6">
          {request.quotePrice !== undefined ? (
            <>
              <h2 className="font-display text-2xl font-extrabold">This request is closed</h2>
              <p className="mt-3">The quote of {formatPrice(request.quotePrice * request.quantity)} wasn&apos;t accepted.</p>
              <p className="mt-3 text-sm text-ink-soft">Changed your mind? Reach out at {site.email}, or send a new request.</p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-extrabold">We couldn&apos;t take this one</h2>
              {request.quoteNote && <p className="mt-3 whitespace-pre-wrap">{request.quoteNote}</p>}
              <p className="mt-3 text-sm text-ink-soft">Questions? Reach out at {site.email}.</p>
            </>
          )}
        </section>
      ) : quoted ? (
        <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-sun-soft p-6">
          <h2 className="font-display text-2xl font-extrabold">Your quote</h2>
          <p className="mt-2 font-display text-5xl font-extrabold tabular-nums">{formatPrice(total)}</p>
          {request.quantity > 1 && (
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              {formatPrice(request.quotePrice!)} each × {request.quantity}
            </p>
          )}
          {request.quoteNote && <p className="mt-4 whitespace-pre-wrap">{request.quoteNote}</p>}
          {request.status === "quoted" ? (
            <>
              <p className="mt-4 text-sm text-ink-soft">Like it? Accept the quote and we&apos;ll get started. No payment is taken online.</p>
              <QuoteAnswer id={request.id} total={total} />
            </>
          ) : (
            <>
              <p className="mt-4 text-sm font-semibold">You accepted this quote. Great, we&apos;re on it!</p>
              {request.orderId && (
                <Link href={`/order/${request.orderId}`} className="btn btn-primary btn-sm mt-3">
                  See your order and how to pay
                </Link>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-sky-soft p-6">
          <h2 className="font-display text-2xl font-extrabold">We&apos;re taking a look</h2>
          <p className="mt-2">We&apos;ll check the model and get back to you with a price soon.</p>
        </section>
      )}

      {!declined && (
        <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-paper p-6" aria-label="Progress">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 font-display text-2xl font-extrabold">Progress</h2>
            <span className={`chip text-xs ${status.tone}`}>{status.label}</span>
          </div>
          <ol className="mt-5 space-y-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink text-sm font-extrabold ${s.done ? "bg-mint" : "bg-paper text-ink-faint"}`}
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
        </section>
      )}

      <section className="chunky mt-8 rounded-[var(--radius-blob)] bg-paper p-6">
        <h2 className="font-display text-2xl font-extrabold">What you asked for</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-ink-soft">The print</dt>
            <dd className="break-all">
              {/* The address is a customer's own text: shown as a plain link that opens safely in a new tab. */}
              <a href={request.modelUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline decoration-2 underline-offset-2">
                {linkHost(request.modelUrl)}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-soft">How many</dt>
            <dd>{request.quantity}</dd>
          </div>
          {request.colors.length > 0 && (
            <div>
              <dt className="font-semibold text-ink-soft">Colors you picked</dt>
              <dd>
<ul className="mt-1 flex flex-wrap gap-2" aria-label="Colors picked">
  {request.colors.map((c) => (
    <li key={c.id} className="chip flex items-center gap-2 bg-cream-deep">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-ink" style={swatchBackground(c)} />
      {c.name} <span className="text-ink-soft">{c.family}</span>
    </li>
  ))}
</ul>
              </dd>
            </div>
          )}
          <div>
            <dt className="font-semibold text-ink-soft">Your message</dt>
            <dd className="whitespace-pre-wrap">{request.message}</dd>
          </div>
        </dl>
      </section>

      <Link href="/shop" className="btn btn-secondary mt-8">
        Keep browsing
      </Link>
    </div>
  );
}
