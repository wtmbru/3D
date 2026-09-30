"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerQuote } from "@/app/(store)/request/[id]/actions";
import { formatPrice } from "@/lib/pricing";

/** Accept or decline the quote, with a confirm step so a stray tap can't commit anyone. */
export function QuoteAnswer({ id, total }: { id: string; total: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function send(decision: "accepted" | "declined") {
    setError(null);
    start(async () => {
      const res = await answerQuote(id, decision);
      if (!res.ok) setError(res.error);
      setAsk(null);
      router.refresh();
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
          <p className="mt-1 text-sm text-ink-soft">
            {ask === "accepted" ? "We'll get started and be in touch about payment and pickup." : "We'll let it go. You can always send a new request."}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => send(ask)}>
              {pending ? "Saving…" : ask === "accepted" ? "Yes, accept" : "Yes, decline"}
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
