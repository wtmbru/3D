"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { contactMatches, type TrackResult } from "@/lib/lookup";
import { orderLabel, ORDER_STATUSES } from "@/lib/orders";
import { requestLabel, REQUEST_STATUSES } from "@/lib/requests";
import { clientIp } from "@/lib/server/auth";
import { listOrdersByEmail } from "@/lib/server/orders";
import { listRequestsByEmail } from "@/lib/server/requests";

const schema = z.object({
  email: z.string().trim().email("Please enter the email you used.").max(200),
  phone: z.string().trim().max(40).optional(),
  name: z.string().trim().max(80).optional(),
  /** Honeypot. */
  website: z.string().max(200).optional(),
});

export type TrackInput = z.input<typeof schema>;
export type TrackResponse = { ok: true; results: TrackResult[] } | { ok: false; error: string };

// A guessing brake. It lives in this server's memory, so it's best-effort: enough to stop
// casual guessing, not a substitute for the details having to match.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 8;
const g = globalThis as unknown as { __trackTries?: Map<string, number[]> };

function tooMany(key: string): boolean {
  const map: Map<string, number[]> = (g.__trackTries ??= new Map());
  const now = Date.now();
  const recent = (map.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  map.set(key, recent);
  if (map.size > 5000) for (const [k, v] of map) if (v.every((t) => now - t >= WINDOW_MS)) map.delete(k);
  return recent.length > MAX_TRIES;
}

/**
 * Find someone's own orders and requests: the email plus their phone number and/or name,
 * all of which have to match. Only safe details come back (no contact info), plus the
 * link to each page.
 */
export async function trackOrders(input: TrackInput): Promise<TrackResponse> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const { email, phone, name, website } = parsed.data;
  if (website) return { ok: false, error: "Something went wrong. Please try again." };
  if (!(phone && phone.replace(/\D/g, "").length >= 7) && !name) {
    return { ok: false, error: "Add your phone number or the name you ordered under, along with your email." };
  }

  try {
    const key = createHash("sha256").update(`${await clientIp()}|${process.env.ADMIN_SESSION_SECRET ?? ""}`).digest("hex");
    if (tooMany(key)) return { ok: false, error: "Too many tries. Please wait a few minutes and try again." };

    const [orders, requests] = await Promise.all([listOrdersByEmail(email), listRequestsByEmail(email)]);
    const given = { phone, name };
    const results: TrackResult[] = [
      ...orders
        .filter((o) => contactMatches(o, given))
        .map((o): TrackResult => ({
          kind: "order",
          id: o.id,
          label: orderLabel(o.number),
          createdAt: o.createdAt,
          status: ORDER_STATUSES.find((s) => s.id === o.status)?.label ?? o.status,
          total: o.total,
        })),
      ...requests
        .filter((r) => contactMatches(r, given))
        .map((r): TrackResult => ({
          kind: "request",
          id: r.id,
          label: requestLabel(r.number),
          createdAt: r.createdAt,
          status: r.status === "quoted" ? "Quote ready" : (REQUEST_STATUSES.find((s) => s.id === r.status)?.label ?? r.status),
          ...(r.quotePrice !== undefined && r.status !== "new" ? { total: r.quotePrice * r.quantity } : {}),
        })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: true, results };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "We couldn't look that up just now. Please try again in a moment." };
  }
}
