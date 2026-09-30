"use server";

import { after } from "next/server";
import { z } from "zod";
import { notifyQuoteResponse } from "@/lib/server/notify";
import { respondToQuote } from "@/lib/server/requests";

export type QuoteAnswer = { ok: true } | { ok: false; error: string };

/**
 * The customer answers their quote. The request's id is the secret (an unguessable link,
 * same as viewing the page), and it only works while a quote is waiting for an answer.
 */
export async function answerQuote(id: string, decision: "accepted" | "declined"): Promise<QuoteAnswer> {
  const parsed = z.object({ id: z.string().uuid(), decision: z.enum(["accepted", "declined"]) }).safeParse({ id, decision });
  if (!parsed.success) return { ok: false, error: "Something went wrong. Please refresh the page." };
  try {
    const r = await respondToQuote(parsed.data.id, parsed.data.decision);
    if (!r) return { ok: false, error: "This quote was just updated. Please refresh the page to see the latest." };
    after(() => notifyQuoteResponse(r, parsed.data.decision));
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "We couldn't save your answer just now. Please try again in a moment." };
  }
}
