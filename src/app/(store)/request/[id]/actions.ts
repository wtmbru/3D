"use server";

import { after } from "next/server";
import { z } from "zod";
import { orderFromRequest } from "@/lib/customOrder";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders";
import { notifyNewOrder, notifyQuoteResponse } from "@/lib/server/notify";
import { insertOrder } from "@/lib/server/orders";
import { linkRequestOrder, respondToQuote, updateRequest } from "@/lib/server/requests";

export type QuoteAnswer = { ok: true; orderId?: string } | { ok: false; error: string };

const schema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["accepted", "declined"]),
  payment: z.enum(PAYMENT_METHODS.map((m) => m.id) as [string, ...string[]]).optional(),
});

/**
 * The customer answers their quote. The request's id is the secret (an unguessable link,
 * same as viewing the page), and it only works while a quote is waiting for an answer.
 * Accepting turns the request into an order and returns it, so they can go straight to
 * the payment instructions.
 */
export async function answerQuote(id: string, decision: "accepted" | "declined", payment?: string): Promise<QuoteAnswer> {
  const parsed = schema.safeParse({ id, decision, payment });
  if (!parsed.success) return { ok: false, error: "Please choose how you'd like to pay." };
  if (parsed.data.decision === "accepted" && !parsed.data.payment) return { ok: false, error: "Please choose how you'd like to pay." };

  try {
    // The status flip is the lock: only one answer can win, so only one order is ever made.
    const r = await respondToQuote(parsed.data.id, parsed.data.decision);
    if (!r) return { ok: false, error: "This quote was just updated. Please refresh the page to see the latest." };

    if (parsed.data.decision === "declined") {
      after(() => notifyQuoteResponse(r, "declined"));
      return { ok: true };
    }

    let order;
    try {
      order = await insertOrder(orderFromRequest(r, parsed.data.payment as PaymentMethod));
    } catch (e) {
      // Don't leave them "accepted" with no order: put the quote back so they can try again.
      await updateRequest(r.id, { status: "quoted" }).catch(() => undefined);
      throw e;
    }
    // Only a convenience link: the order exists either way, so a missing column mustn't fail this.
    await linkRequestOrder(r.id, order.id).catch((e) => console.error("Couldn't link request to order (run migration 0006?):", e));
    after(() => notifyNewOrder(order));
    return { ok: true, orderId: order.id };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "We couldn't save your answer just now. Please try again in a moment." };
  }
}
