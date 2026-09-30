"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerQuote } from "@/app/(store)/request/[id]/actions";
import { PAYMENT_METHODS } from "@/lib/orders";
import { formatPrice } from "@/lib/pricing";

/** Accept or decline the quote, with a confirm step so a stray tap can't commit anyone. */
export function QuoteAnswer({ id, total }: { id: string; total: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<"accepted" | "declined" | null>(null);
  const [payment, setPayment] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function send(decision: "accepted" | "declined") {
    setError(null);
    start(async () => {
      const res = await answerQuote(id, decision, decision === "accepted" ? payment : undefined);
      if (!res.ok) {
        setError(res.error);
        setAsk(null);
        router.refresh();
        return;
      }
      // Accepting makes an order: take them to it for the payment details.
      if (res.orderId) router.push(`/order/${res.orderId}`);
      else router.refresh();
    });
  }

  return (
    <div className="mt-5">
      {ask === null ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => setAsk("accepted")}>
            Accept quote · {formatPrice(total)}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setAsk("declined")}>
            No thanks
          </button>
        </div>
      ) : (
        <div role="alertdialog" aria-label="Confirm your answer" className="chunky rounded-2xl bg-paper p-4">
          <p className="font-display text-lg font-extrabold">
            {ask === "accepted" ? `Accept this quote for ${formatPrice(total)}?` : "Decline this quote?"}
          </p>
          {ask === "accepted" ? (
            <fieldset className="mt-3">
              <legend className="text-sm text-ink-soft">How will you pay? You won&apos;t pay online. We&apos;ll show you where to send it next.</legend>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
                {PAYMENT_METHODS.map((m) => (
                  <label
                    key={m.id}
                    className={`focus-within:ring-sky cursor-pointer rounded-full border-2 px-4 py-1.5 font-display font-bold focus-within:ring-[3px] ${
                      payment === m.id ? "border-ink bg-sun" : "border-ink/25 bg-paper"
                    }`}
                  >
                    <input type="radio" name="payment" value={m.id} checked={payment === m.id} onChange={() => setPayment(m.id)} className="sr-only" />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">We&apos;ll let it go. You can always send a new request.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || (ask === "accepted" && !payment)} onClick={() => send(ask)}>
              {pending ? "Saving…" : ask === "accepted" ? "Yes, accept and place my order" : "Yes, decline"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => setAsk(null)}>
              Go back
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
