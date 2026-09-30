import "server-only";
import { site } from "@/config/site";
import { addressLines } from "@/lib/delivery";
import { orderLabel, paymentLabel, type Order } from "@/lib/orders";
import { colorsSummary, linkHost, requestLabel, type CustomRequest } from "@/lib/requests";
import { formatPrice } from "@/lib/pricing";

/*
 * Tells the shop owner when an order comes in: an email (Resend) and a push
 * notification to her phone (Pushover). Each channel is optional and turns on
 * when its settings exist. A notification can never break an order: failures
 * are logged and returned, never thrown.
 *
 * Settings (all server-side environment variables):
 *   RESEND_API_KEY, NOTIFY_EMAIL_TO (comma-separated), NOTIFY_EMAIL_FROM (optional)
 *   PUSHOVER_APP_TOKEN, PUSHOVER_USER_KEY
 *   SITE_URL (optional, for links; defaults to the Vercel production URL)
 */

export type ChannelStatus = "sent" | "skipped" | "failed";
export interface ChannelResult {
  channel: "email" | "push";
  status: ChannelStatus;
  /** Why it was skipped or failed, in plain words. */
  detail?: string;
}

const TIMEOUT_MS = 8000;

function config() {
  return {
    resendKey: process.env.RESEND_API_KEY?.trim(),
    emailTo: (process.env.NOTIFY_EMAIL_TO ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    // Resend's shared sender works without owning a domain, but only delivers to the account owner's own address.
    emailFrom: process.env.NOTIFY_EMAIL_FROM?.trim() || `${site.name} Orders <onboarding@resend.dev>`,
    pushToken: process.env.PUSHOVER_APP_TOKEN?.trim(),
    pushUser: process.env.PUSHOVER_USER_KEY?.trim(),
    // Overridable so tests can point at a fake server.
    resendUrl: process.env.RESEND_API_URL || "https://api.resend.com/emails",
    pushUrl: process.env.PUSHOVER_API_URL || "https://api.pushover.net/1/messages.json",
  };
}

/** What's switched on, for the Settings page. Never includes secrets. */
export function notificationStatus() {
  const c = config();
  return {
    email: { configured: !!c.resendKey && c.emailTo.length > 0, to: c.emailTo, hasKey: !!c.resendKey },
    push: { configured: !!c.pushToken && !!c.pushUser },
  };
}

/** Base address for links in messages (the admin order page). */
export function siteUrl(): string | undefined {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined;
}

// ── Message content ──────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Strip line breaks so customer text can't fake extra lines in a subject or title. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

function itemLine(i: Order["items"][number]): string {
  const what = `${i.qty > 1 ? `${i.qty} × ` : ""}${i.name}${i.variantName ? ` (${i.variantName})` : ""}`;
  const colors = i.parts.map((p) => `${p.name}: ${p.filamentName}`).join(", ");
  return `${what} — ${colors}${i.addons.length ? ` + ${i.addons.join(", ")}` : ""}`;
}

export function orderMessage(order: Order) {
  const base = siteUrl();
  const adminUrl = base ? `${base}/admin/orders/${order.id}` : undefined;
  const subject = `New order ${orderLabel(order.number)} · ${formatPrice(order.total)} · ${oneLine(order.name)}`;
  const items = order.items.map(itemLine);
  const ship = order.delivery === "shipping" && order.shippingAddress ? addressLines(order.shippingAddress) : null;

  const text = [
    `${site.name}: new order ${orderLabel(order.number)}`,
    ``,
    `${order.name}`,
    `Phone: ${order.phone}`,
    `Email: ${order.email}`,
    `Paying by: ${paymentLabel(order.payment)} (${formatPrice(order.total)})`,
    ship ? `Ship to: ${ship.join(", ")}` : `Local pickup`,
    ``,
    ...items.map((l) => `• ${l}`),
    // Quote the note line by line so nothing in it can pass for one of our own lines.
    ...(order.notes ? [``, `Customer note:`, ...order.notes.split(/\r?\n/).map((l) => `  > ${l}`)] : []),
    ...(adminUrl ? [``, `Open the order: ${adminUrl}`] : []),
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fff6ea;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1640">
<div style="max-width:560px;margin:0 auto;background:#fff;border:2px solid #1f1640;border-radius:20px;padding:24px">
<p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5b527a">${esc(site.name)}</p>
<h1 style="margin:6px 0 0;font-size:26px">New order ${esc(orderLabel(order.number))}</h1>
<p style="margin:4px 0 0;font-size:20px;font-weight:700">${esc(formatPrice(order.total))} <span style="font-weight:400;color:#5b527a">via ${esc(paymentLabel(order.payment))}</span></p>
<hr style="border:none;border-top:2px dashed #e5dcc9;margin:18px 0">
<p style="margin:0;font-size:17px;font-weight:700">${esc(order.name)}</p>
<p style="margin:4px 0 0"><a href="tel:${esc(order.phone.replace(/[^\d+]/g, ""))}" style="color:#1f1640">${esc(order.phone)}</a><br><a href="mailto:${esc(order.email)}" style="color:#1f1640">${esc(order.email)}</a></p>
<hr style="border:none;border-top:2px dashed #e5dcc9;margin:18px 0">
<p style="margin:0 0 12px;padding:10px 14px;background:#d6e4ff;border-radius:12px"><strong>${ship ? "Ship to" : "Local pickup"}</strong>${ship ? `<br>${ship.map(esc).join("<br>")}` : ""}</p>
<ul style="margin:0;padding-left:18px;line-height:1.55">${items.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
${order.notes ? `<p style="margin:16px 0 0;padding:10px 14px;background:#fff0c2;border-radius:12px"><strong>Customer note:</strong> ${esc(order.notes)}</p>` : ""}
${adminUrl ? `<p style="margin:22px 0 0"><a href="${esc(adminUrl)}" style="display:inline-block;background:#ff5e3a;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;border:2px solid #1f1640">Open the order</a></p>` : ""}
</div></body></html>`;

  // Pushover limits: title 250 chars, message 1024.
  const push = {
    title: `New order ${orderLabel(order.number)}`.slice(0, 250),
    message: [`${oneLine(order.name)} · ${formatPrice(order.total)} · ${paymentLabel(order.payment)} · ${ship ? "SHIP" : "Pickup"}`, ...items.slice(0, 5).map((l) => `• ${l}`)]
      .join("\n")
      .slice(0, 1000),
    url: adminUrl,
  };
  return { subject, text, html, push };
}

/** Same shape as an order message, so the same email and phone senders work for it. */
export function requestMessage(r: CustomRequest): ReturnType<typeof orderMessage> {
  const base = siteUrl();
  const adminUrl = base ? `${base}/admin/requests/${r.id}` : undefined;
  const host = linkHost(r.modelUrl);
  const subject = `New custom print request ${requestLabel(r.number)} · ${oneLine(r.name)} · ${host}`;
  const colors = colorsSummary(r.colors);
  const message = r.message.length > 600 ? `${r.message.slice(0, 600)}…` : r.message;

  const text = [
    `${site.name}: new custom print request ${requestLabel(r.number)}`,
    ``,
    `${r.name}`,
    `Phone: ${r.phone}`,
    `Email: ${r.email}`,
    ``,
    `Model (${host}): ${r.modelUrl}`,
    `Quantity: ${r.quantity}`,
    `Delivery: ${r.delivery === "shipping" ? "wants shipping" : "local pickup"}`,
    ...(colors ? [`Colors picked: ${colors}`] : []),
    ``,
    `Their message:`,
    // Quoted line by line so nothing in it can pass for one of our own lines.
    ...message.split(/\r?\n/).map((l) => `  > ${l}`),
    ...(adminUrl ? [``, `Review it and send a price: ${adminUrl}`] : []),
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fff6ea;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1640">
<div style="max-width:560px;margin:0 auto;background:#fff;border:2px solid #1f1640;border-radius:20px;padding:24px">
<p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5b527a">${esc(site.name)}</p>
<h1 style="margin:6px 0 0;font-size:26px">Custom print request ${esc(requestLabel(r.number))}</h1>
<hr style="border:none;border-top:2px dashed #e5dcc9;margin:18px 0">
<p style="margin:0;font-size:17px;font-weight:700">${esc(r.name)}</p>
<p style="margin:4px 0 0"><a href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}" style="color:#1f1640">${esc(r.phone)}</a><br><a href="mailto:${esc(r.email)}" style="color:#1f1640">${esc(r.email)}</a></p>
<hr style="border:none;border-top:2px dashed #e5dcc9;margin:18px 0">
<p style="margin:0"><strong>Model:</strong> <a href="${esc(r.modelUrl)}" style="color:#1f1640">${esc(r.modelUrl.length > 80 ? `${r.modelUrl.slice(0, 80)}…` : r.modelUrl)}</a> <span style="color:#5b527a">(${esc(host)})</span></p>
<p style="margin:6px 0 0"><strong>Quantity:</strong> ${r.quantity}</p>
<p style="margin:6px 0 0"><strong>Delivery:</strong> ${r.delivery === "shipping" ? "wants shipping" : "local pickup"}</p>
${colors ? `<p style="margin:6px 0 0"><strong>Colors picked:</strong> ${esc(colors)}</p>` : ""}
<p style="margin:16px 0 0;padding:12px 14px;background:#fff0c2;border-radius:12px;white-space:pre-wrap">${esc(message)}</p>
${adminUrl ? `<p style="margin:22px 0 0"><a href="${esc(adminUrl)}" style="display:inline-block;background:#ff5e3a;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;border:2px solid #1f1640">Review and send a price</a></p>` : ""}
</div></body></html>`;

  const push = {
    title: `Custom request ${requestLabel(r.number)}`.slice(0, 250),
    message: `${oneLine(r.name)} · ${host}${r.delivery === "shipping" ? " · SHIP" : ""}${colors ? `\n🎨 ${oneLine(colors)}` : ""}\n${oneLine(r.message)}`.slice(0, 1000),
    url: adminUrl,
  };
  return { subject, text, html, push };
}

// ── Sending ──────────────────────────────────────────────────────────────────

async function post(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON error page; the status code is enough.
  }
  return { ok: res.ok, status: res.status, body };
}

async function sendEmail(msg: ReturnType<typeof orderMessage>): Promise<ChannelResult> {
  const c = config();
  if (!c.resendKey || c.emailTo.length === 0) return { channel: "email", status: "skipped", detail: "Email isn't set up yet." };
  try {
    const res = await post(c.resendUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: c.emailFrom, to: c.emailTo, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (res.ok) return { channel: "email", status: "sent" };
    const reason = (res.body as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    return { channel: "email", status: "failed", detail: reason };
  } catch (e) {
    return { channel: "email", status: "failed", detail: e instanceof Error ? e.message : "Couldn't reach the email service." };
  }
}

async function sendPush(msg: ReturnType<typeof orderMessage>): Promise<ChannelResult> {
  const c = config();
  if (!c.pushToken || !c.pushUser) return { channel: "push", status: "skipped", detail: "Phone notifications aren't set up yet." };
  try {
    const form = new URLSearchParams({ token: c.pushToken, user: c.pushUser, title: msg.push.title, message: msg.push.message });
    if (msg.push.url) {
      form.set("url", msg.push.url);
      form.set("url_title", "Open order");
    }
    const res = await post(c.pushUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const body = res.body as { status?: number; errors?: string[] } | null;
    if (res.ok && body?.status === 1) return { channel: "push", status: "sent" };
    return { channel: "push", status: "failed", detail: body?.errors?.join(" ") ?? `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "push", status: "failed", detail: e instanceof Error ? e.message : "Couldn't reach Pushover." };
  }
}

/** Sends every configured channel. Never throws. */
export async function notifyNewOrder(order: Order): Promise<ChannelResult[]> {
  const msg = orderMessage(order);
  const results = await Promise.all([sendEmail(msg), sendPush(msg)]);
  for (const r of results) {
    if (r.status === "failed") console.error(`Order ${orderLabel(order.number)}: ${r.channel} notification failed: ${r.detail}`);
  }
  return results;
}

/** Tells the shop owner about a new custom print request. Never throws. */
export async function notifyNewRequest(r: CustomRequest): Promise<ChannelResult[]> {
  const msg = requestMessage(r);
  const results = await Promise.all([sendEmail(msg), sendPush(msg)]);
  for (const res of results) {
    if (res.status === "failed") console.error(`Request ${requestLabel(r.number)}: ${res.channel} notification failed: ${res.detail}`);
  }
  return results;
}

/** Tells the shop owner the customer accepted or declined a quote. Never throws. */
export async function notifyQuoteResponse(r: CustomRequest, decision: "accepted" | "declined"): Promise<ChannelResult[]> {
  const base = siteUrl();
  const adminUrl = base ? `${base}/admin/requests/${r.id}` : undefined;
  const verb = decision === "accepted" ? "ACCEPTED" : "declined";
  const price = r.quotePrice !== undefined ? formatPrice(r.quotePrice * r.quantity) : "";
  const subject = `Quote ${verb} · ${requestLabel(r.number)} · ${oneLine(r.name)}`;
  const text = [
    `${site.name}: ${oneLine(r.name)} ${verb} the quote for request ${requestLabel(r.number)}${price ? ` (${price})` : ""}.`,
    `Phone: ${r.phone}`,
    `Email: ${r.email}`,
    ...(adminUrl ? [``, `Open it: ${adminUrl}`] : []),
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fff6ea;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1640">
<div style="max-width:560px;margin:0 auto;background:#fff;border:2px solid #1f1640;border-radius:20px;padding:24px">
<p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5b527a">${esc(site.name)}</p>
<h1 style="margin:6px 0 0;font-size:26px">Quote ${esc(verb)} · ${esc(requestLabel(r.number))}</h1>
<p style="margin:12px 0 0;font-size:17px"><strong>${esc(r.name)}</strong>${price ? ` · ${esc(price)}` : ""}</p>
<p style="margin:4px 0 0"><a href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}" style="color:#1f1640">${esc(r.phone)}</a><br><a href="mailto:${esc(r.email)}" style="color:#1f1640">${esc(r.email)}</a></p>
${adminUrl ? `<p style="margin:22px 0 0"><a href="${esc(adminUrl)}" style="display:inline-block;background:#ff5e3a;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;border:2px solid #1f1640">Open the request</a></p>` : ""}
</div></body></html>`;
  const msg = {
    subject,
    text,
    html,
    push: { title: `Quote ${verb} · ${requestLabel(r.number)}`.slice(0, 250), message: `${oneLine(r.name)}${price ? ` · ${price}` : ""}`.slice(0, 1000), url: adminUrl },
  };
  const results = await Promise.all([sendEmail(msg), sendPush(msg)]);
  for (const res of results) {
    if (res.status === "failed") console.error(`Request ${requestLabel(r.number)}: ${res.channel} quote-response notification failed: ${res.detail}`);
  }
  return results;
}

/** A pretend order, used by the Settings page's "Send a test" button. */
export function sampleOrder(): Order {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    number: 0,
    createdAt: new Date().toISOString(),
    name: "Test Customer",
    email: "test@example.com",
    phone: "(555) 123-4567",
    payment: "zelle",
    notes: "This is a test. No real order was placed.",
    total: 0,
    delivery: "pickup",
    paymentStatus: "unpaid",
    status: "new",
    items: [
      {
        id: "test",
        productId: "test",
        slug: "test",
        name: "Test notification",
        family: "PLA",
        qty: 1,
        unitPrice: 0,
        config: {},
        parts: [{ id: "body", name: "Body", filamentId: "x", filamentName: "Sunflower", finish: "basic", hex: "#FFC928" }],
        addons: [],
        status: "queued",
      },
    ],
  };
}

export async function sendTestNotification(): Promise<ChannelResult[]> {
  const order = sampleOrder();
  const msg = orderMessage(order);
  msg.subject = `TEST · ${site.name} order notifications work`;
  msg.push.title = "Test notification";
  msg.push.message = "If you can read this, order notifications are working. 🎉";
  msg.push.url = siteUrl() ? `${siteUrl()}/admin/orders` : undefined;
  return Promise.all([sendEmail(msg), sendPush(msg)]);
}
