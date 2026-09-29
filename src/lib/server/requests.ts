import "server-only";
import { randomUUID } from "node:crypto";
import type { CustomRequest, RequestStatus } from "@/lib/requests";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";

/*
 * Custom print requests live in Supabase. Without Supabase, local development
 * uses an in-memory store so the flow can be tried offline (production never does).
 */

type Row = {
  id: string;
  number: number;
  created_at: string;
  customer_name: string;
  email: string;
  phone: string;
  model_url: string;
  message: string;
  quantity: number;
  status: RequestStatus;
  quote_price: string | number | null;
  quote_note: string | null;
  quoted_at: string | null;
  admin_notes: string | null;
};

const fromRow = (r: Row): CustomRequest => ({
  id: r.id,
  number: r.number,
  createdAt: r.created_at,
  name: r.customer_name,
  email: r.email,
  phone: r.phone,
  modelUrl: r.model_url,
  message: r.message,
  quantity: r.quantity,
  status: r.status,
  ...(r.quote_price !== null ? { quotePrice: Number(r.quote_price) } : {}),
  ...(r.quote_note ? { quoteNote: r.quote_note } : {}),
  ...(r.quoted_at ? { quotedAt: r.quoted_at } : {}),
  ...(r.admin_notes ? { adminNotes: r.admin_notes } : {}),
});

export interface NewRequest {
  name: string;
  email: string;
  phone: string;
  modelUrl: string;
  message: string;
  quantity: number;
  ipHash?: string;
}

/** Fields the shop may change. `quotePrice: null` clears a quote. */
export interface RequestPatch {
  status?: RequestStatus;
  quotePrice?: number | null;
  quoteNote?: string;
  adminNotes?: string;
}

const g = globalThis as unknown as { __memRequests?: { list: (CustomRequest & { ipHash?: string })[]; seq: number } };
const mem = () => (g.__memRequests ??= { list: [], seq: 100 });

function backend(): "db" | "memory" {
  if (isSupabaseConfigured()) return "db";
  if (process.env.NODE_ENV !== "production") return "memory";
  throw new Error("Requests aren't available yet: Supabase isn't configured.");
}

function check(error: { message: string } | null, what: string) {
  if (!error) return;
  if (/relation .*custom_requests|Could not find the table|schema cache/.test(error.message)) {
    throw new Error("The database needs an update: run supabase/migrations/0004_custom_requests.sql in Supabase's SQL Editor.");
  }
  throw new Error(`${what} failed: ${error.message}`);
}

export async function insertRequest(r: NewRequest): Promise<CustomRequest> {
  if (backend() === "memory") {
    const m = mem();
    const req: CustomRequest & { ipHash?: string } = {
      id: randomUUID(),
      number: ++m.seq,
      createdAt: new Date().toISOString(),
      name: r.name,
      email: r.email,
      phone: r.phone,
      modelUrl: r.modelUrl,
      message: r.message,
      quantity: r.quantity,
      status: "new",
      ipHash: r.ipHash,
    };
    m.list.unshift(req);
    return req;
  }
  const { data, error } = await supabaseAdmin()
    .from("custom_requests")
    .insert({
      customer_name: r.name,
      email: r.email,
      phone: r.phone,
      model_url: r.modelUrl,
      message: r.message,
      quantity: r.quantity,
      ip_hash: r.ipHash ?? null,
    })
    .select("*")
    .single();
  check(error, "Saving the request");
  return fromRow(data as Row);
}

export async function listRequests(limit = 500): Promise<CustomRequest[]> {
  if (backend() === "memory") return mem().list.slice(0, limit);
  const { data, error } = await supabaseAdmin().from("custom_requests").select("*").order("created_at", { ascending: false }).limit(limit);
  check(error, "Loading requests");
  return (data as Row[]).map(fromRow);
}

export async function getRequestById(id: string): Promise<CustomRequest | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return undefined;
  if (backend() === "memory") return mem().list.find((x) => x.id === id);
  const { data, error } = await supabaseAdmin().from("custom_requests").select("*").eq("id", id).maybeSingle();
  check(error, "Loading the request");
  return data ? fromRow(data as Row) : undefined;
}

export async function updateRequest(id: string, patch: RequestPatch): Promise<CustomRequest | undefined> {
  const now = new Date().toISOString();
  if (backend() === "memory") {
    const x = mem().list.find((q) => q.id === id);
    if (!x) return undefined;
    if (patch.status) x.status = patch.status;
    if (patch.quotePrice !== undefined) {
      x.quotePrice = patch.quotePrice ?? undefined;
      x.quotedAt = patch.quotePrice === null ? undefined : now;
    }
    if (patch.quoteNote !== undefined) x.quoteNote = patch.quoteNote || undefined;
    if (patch.adminNotes !== undefined) x.adminNotes = patch.adminNotes || undefined;
    return x;
  }
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.quotePrice !== undefined) {
    row.quote_price = patch.quotePrice;
    row.quoted_at = patch.quotePrice === null ? null : now;
  }
  if (patch.quoteNote !== undefined) row.quote_note = patch.quoteNote || null;
  if (patch.adminNotes !== undefined) row.admin_notes = patch.adminNotes || null;
  const { data, error } = await supabaseAdmin().from("custom_requests").update(row).eq("id", id).select("*").maybeSingle();
  check(error, "Updating the request");
  return data ? fromRow(data as Row) : undefined;
}

export async function deleteRequest(id: string): Promise<void> {
  if (backend() === "memory") {
    const m = mem();
    m.list = m.list.filter((x) => x.id !== id);
    return;
  }
  const { error } = await supabaseAdmin().from("custom_requests").delete().eq("id", id);
  check(error, "Deleting the request");
}

export async function countNewRequests(): Promise<number> {
  try {
    if (backend() === "memory") return mem().list.filter((x) => x.status === "new").length;
    const { count } = await supabaseAdmin().from("custom_requests").select("id", { count: "exact", head: true }).eq("status", "new");
    return count ?? 0;
  } catch {
    return 0; // the nav badge must never break an admin page (e.g. before the migration has run)
  }
}

/** Requests from this (hashed) address recently: a spam brake. */
export async function countRecentRequests(ipHash: string, sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  if (backend() === "memory") return mem().list.filter((x) => x.ipHash === ipHash && x.createdAt >= since).length;
  const { count, error } = await supabaseAdmin()
    .from("custom_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  check(error, "Checking recent requests");
  return count ?? 0;
}
