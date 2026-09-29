"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { swatchBackground } from "@/components/Swatch";
import { formatPrice } from "@/lib/pricing";
import { parseLink, REQUEST_STATUSES, replyText, requestLabel, type CustomRequest, type RequestStatus } from "@/lib/requests";
import { removeRequest, saveRequestNotes, sendQuote, setRequestStatus } from "../../../request-actions";
import { Notice, useNotice } from "../../ui";
import { When } from "../../orders/badges";
import { RequestBadge } from "../badges";

export function RequestDetail({ request }: { request: CustomRequest }) {
  const router = useRouter();
  const [notice, setNotice] = useNotice();
  const [pending, start] = useTransition();
  const [view, apply] = useOptimistic(request, (r, patch: Partial<CustomRequest>) => ({ ...r, ...patch }));
  const [copied, setCopied] = useState<string | null>(null);
  // What's being typed; otherwise the boxes show what's saved.
  const [price, setPrice] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const link = parseLink(request.modelUrl);
  const priceText = price ?? (view.quotePrice !== undefined ? String(view.quotePrice) : "");
  const noteText = note ?? view.quoteNote ?? "";
  const priceNumber = Number(priceText);
  const priceValid = priceText.trim() !== "" && Number.isFinite(priceNumber) && priceNumber >= 0;
  const quoteChanged = priceValid && (priceNumber !== view.quotePrice || noteText.trim() !== (view.quoteNote ?? ""));
  // The customer's page address depends on where this admin is open, so read it when needed.
  const trackingUrl = () => `${window.location.origin}/request/${request.id}`;
  const shownOrigin = typeof window === "undefined" ? "" : window.location.origin;

  function save(patch: Partial<CustomRequest>, action: () => Promise<{ ok: boolean; error?: string }>, doneText?: string) {
    start(async () => {
      apply(patch);
      const res = await action();
      if (res.ok) {
        if (doneText) setNotice({ kind: "ok", text: doneText });
      } else setNotice({ kind: "error", text: res.error ?? "Couldn't save that." });
    });
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setNotice({ kind: "error", text: "Couldn't copy. Select the text and copy it by hand." });
    }
  }

  const replyFor = (origin: string) =>
    view.quotePrice !== undefined ? replyText(view, { price: view.quotePrice, note: view.quoteNote ?? "" }, `${origin}/request/${request.id}`) : "";

  return (
    <div>
      <Link href="/admin/requests" className="text-sm font-semibold text-ink-soft hover:text-ink">
        ← Custom requests
      </Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Request {requestLabel(request.number)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-soft">
            <span>
              Sent <When iso={request.createdAt} />
            </span>
            <RequestBadge status={view.status} />
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(trackingUrl(), "link")}>
          {copied === "link" ? "Link copied!" : "Copy customer's page link"}
        </button>
      </div>

      <div className="mt-3 min-h-10">
        <Notice notice={notice} />
      </div>

      <div className="mt-2 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="admin-card" aria-label="The request">
            <h2 className="admin-h2">The print</h2>
            <div className="mt-3 rounded-2xl bg-cream p-4">
              {link ? (
                <>
                  <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">
                    {link.isMakerWorld ? "MakerWorld" : `Link to ${link.host}`}
                  </p>
                  {!link.isMakerWorld && <p className="mt-1 text-sm font-semibold text-tomato">Not a MakerWorld link. Check where it goes before opening it.</p>}
                  <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block break-all font-semibold underline decoration-2 underline-offset-2">
                    {link.url}
                  </a>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary btn-sm">
                      Open the print ↗
                    </a>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(link.url, "url")}>
                      {copied === "url" ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="break-all">{request.modelUrl}</p>
              )}
              <p className="mt-3 text-xs text-ink-soft">
                Before quoting: check the model&apos;s license allows selling prints (some designers need a commercial license or membership).
              </p>
            </div>

            <h3 className="mt-5 text-xs font-bold tracking-wide text-ink-soft uppercase">What they want</h3>
            <p className="mt-1 whitespace-pre-wrap text-[15px]">{request.message}</p>
            {request.colors.length > 0 && (
<ul className="mt-3 flex flex-wrap gap-2" aria-label="Colors picked">
  {request.colors.map((c) => (
    <li key={c.id} className="chip flex items-center gap-2 bg-cream-deep">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-ink" style={swatchBackground(c)} />
      {c.name} <span className="text-ink-soft">{c.family}</span>
    </li>
  ))}
</ul>
)}
            <p className="mt-3 text-sm">
              <span className="font-semibold text-ink-soft">Quantity:</span> <strong>{request.quantity}</strong>
            </p>
          </section>

          <section className="admin-card" aria-label="Customer">
            <h2 className="admin-h2">Customer</h2>
            <p className="mt-2 font-display text-lg font-bold">{request.name}</p>
            <ContactRow label="Phone" value={request.phone} href={`tel:${request.phone.replace(/[^\d+]/g, "")}`} copied={copied === "phone"} onCopy={() => copy(request.phone, "phone")} />
            <ContactRow label="Email" value={request.email} href={`mailto:${request.email}`} copied={copied === "email"} onCopy={() => copy(request.email, "email")} />
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24">
          <section className="admin-card" aria-label="Your reply">
            <h2 className="admin-h2">Your reply</h2>
            <p className="mt-1 text-sm text-ink-soft">The price you send is shown to the customer on their page.</p>
            <label className="mt-4 block">
              <span className="admin-label">Price{request.quantity > 1 ? " each" : ""}</span>
              <div className="relative max-w-44">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">$</span>
                <input
                  className="admin-input pl-7"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priceText}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              {request.quantity > 1 && priceValid && (
                <span className="admin-hint">
                  {formatPrice(priceNumber)} × {request.quantity} = <strong>{formatPrice(priceNumber * request.quantity)}</strong> total
                </span>
              )}
            </label>
            <label className="mt-4 block">
              <span className="admin-label">Note to the customer (optional)</span>
              <textarea
                className="admin-input min-h-24"
                maxLength={2000}
                placeholder="Colors confirmed, ready in about a week, pickup details…"
                value={noteText}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!quoteChanged || pending}
                onClick={() =>
                  save(
                    { quotePrice: priceNumber, quoteNote: noteText.trim(), status: "quoted" },
                    () => sendQuote(request.id, priceNumber, noteText),
                    "Quote saved. The customer can see it on their page.",
                  )
                }
              >
                {view.quotePrice !== undefined ? "Update quote" : "Save quote"}
              </button>
              {view.quotePrice !== undefined && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(replyFor(window.location.origin), "reply")}>
                  {copied === "reply" ? "Copied!" : "Copy message to send"}
                </button>
              )}
            </div>
            <p className="admin-hint">
              Saving doesn&apos;t send anything by itself. Use <strong>Copy message to send</strong> to text or email them, or they can check their page.
            </p>
            {view.quotePrice !== undefined && (
              <pre suppressHydrationWarning className="mt-3 max-h-48 overflow-auto rounded-xl bg-cream p-3 text-xs whitespace-pre-wrap">
                {replyFor(shownOrigin)}
              </pre>
            )}
          </section>

          <section className="admin-card" aria-label="Status">
            <h2 className="admin-h2">Status</h2>
            <div role="radiogroup" aria-label="Request status" className="mt-3 flex w-full flex-wrap rounded-full border-2 border-ink p-0.5">
              {REQUEST_STATUSES.map((s) => {
                const on = s.id === view.status;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => !on && save({ status: s.id as RequestStatus }, () => setRequestStatus(request.id, s.id))}
                    className={`flex-1 rounded-full px-2.5 py-1 text-sm font-bold transition-colors ${on ? "bg-ink text-cream" : "hover:bg-cream-deep"}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-soft">{REQUEST_STATUSES.find((s) => s.id === view.status)?.hint}. Mark it Accepted once the customer says yes.</p>
            {view.status === "declined" && <p className="mt-2 text-xs text-ink-soft">Your note above is shown to the customer as the reason.</p>}
          </section>

          <section className="admin-card" aria-label="Your notes">
            <label htmlFor="req-notes" className="admin-h2">
              Your notes
            </label>
            <textarea
              id="req-notes"
              className="admin-input mt-2 min-h-20"
              placeholder="Private notes, e.g. license checked, needs a bigger plate…"
              maxLength={4000}
              value={notes ?? view.adminNotes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                const text = (notes ?? "").trim();
                if (notes !== null && text !== (view.adminNotes ?? "")) save({ adminNotes: text }, () => saveRequestNotes(request.id, text));
                setNotes(null);
              }}
            />
            <p className="admin-hint">Only you can see this. Saves when you click away.</p>
          </section>

          <button
            type="button"
            disabled={pending}
            className="text-sm font-semibold text-ink-soft underline decoration-2 underline-offset-4 hover:text-tomato"
            onClick={() => {
              if (!confirm(`Delete request ${requestLabel(request.number)} for good? Use this for spam or tests.`)) return;
              start(async () => {
                const res = await removeRequest(request.id);
                if (res.ok) router.push("/admin/requests");
                else setNotice({ kind: "error", text: res.error });
              });
            }}
          >
            Delete this request
          </button>
        </div>
      </div>
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
