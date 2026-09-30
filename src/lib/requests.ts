/*
 * Custom print requests: shared by the storefront and the admin panel.
 * Pure (no server or client imports).
 */

export type RequestStatus = "new" | "quoted" | "accepted" | "declined";

export const REQUEST_STATUSES: { id: RequestStatus; label: string; tone: string; hint: string }[] = [
  { id: "new", label: "New", tone: "bg-sun", hint: "Waiting for you to look at it" },
  { id: "quoted", label: "Quoted", tone: "bg-sky-soft", hint: "You sent a price" },
  { id: "accepted", label: "Accepted", tone: "bg-mint-soft", hint: "The customer said yes" },
  { id: "declined", label: "Declined", tone: "bg-cream-deep", hint: "Won't be made" },
];

import type { DeliveryMethod } from "./delivery";
import type { Filament } from "./types";

/** A color the customer picked, saved as it was at the time. */
export type RequestColor = Pick<Filament, "id" | "name" | "family" | "finish" | "hex" | "hex2">;

/** "Sunflower, Mint (PLA)" style summary for messages. */
export function colorsSummary(colors: RequestColor[] | undefined): string {
  return (colors ?? []).map((c) => `${c.name} (${c.family})`).join(", ");
}

export interface CustomRequest {
  id: string;
  /** Friendly number shown to people: 101, 102… */
  number: number;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  modelUrl: string;
  message: string;
  quantity: number;
  /** What they asked for when sending the request; the address comes when they accept. */
  delivery: DeliveryMethod;
  /** The order this became once the customer accepted the quote. */
  orderId?: string;
  /** Colors picked from what's in stock (may be empty). */
  colors: RequestColor[];
  status: RequestStatus;
  /** Her reply. */
  quotePrice?: number;
  quoteNote?: string;
  quotedAt?: string;
  adminNotes?: string;
}

export const requestLabel = (n: number) => `#${n}`;

export interface ParsedLink {
  /** Cleaned-up https link, safe to store and show. */
  url: string;
  host: string;
  isMakerWorld: boolean;
}

/**
 * Accepts what people actually paste ("makerworld.com/en/models/123" or a full
 * link) and returns a clean http(s) link, or null. Rejects other schemes
 * (javascript:, data:, file:…), and links carrying a username or password.
 */
export function parseLink(input: string): ParsedLink | null {
  let text = input.trim();
  if (!text || /\s/.test(text)) return null; // one link only
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".")) return null;
  const isMakerWorld = /(^|\.)makerworld\.(com|cn)$/.test(host) || /(^|\.)bambulab\.com$/.test(host);
  return { url: u.toString(), host, isMakerWorld };
}

/** A short name for a link, like "makerworld.com". */
export const linkHost = (url: string) => parseLink(url)?.host ?? "link";

/** Ready-to-send reply text for the admin to copy into a text or email. */
export function replyText(r: CustomRequest, quote: { price: number; note: string }, trackingUrl: string): string {
  const first = r.name.split(" ")[0];
  const total = quote.price * r.quantity;
  return [
    `Hi ${first}! Thanks for your custom print request ${requestLabel(r.number)}.`,
    ``,
    r.quantity > 1
      ? `Price: $${quote.price.toFixed(2)} each × ${r.quantity} = $${total.toFixed(2)}`
      : `Price: $${quote.price.toFixed(2)}`,
    ...(quote.note.trim() ? [``, quote.note.trim()] : []),
    ``,
    `You can see your request and this quote here: ${trackingUrl}`,
    `Let me know if you'd like to go ahead!`,
  ].join("\n");
}
