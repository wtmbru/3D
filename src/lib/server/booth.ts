import "server-only";
import { randomUUID } from "node:crypto";
import { boothTotals, type BoothItem, type BoothSession, type BoothTotals } from "@/lib/booth";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";

/*
 * Booth sales live in Supabase. Without Supabase, local development uses an in-memory
 * store so the feature can be tried offline (production never does).
 */

type SessionRow = { id: string; created_at: string; name: string; day: string };
type ItemRow = { id: string; session_id: string; name: string; price: string | number; cost: string | number; qty: number; created_at?: string };

const sessionFrom = (r: SessionRow): BoothSession => ({ id: r.id, name: r.name, day: r.day, createdAt: r.created_at });
const itemFrom = (r: ItemRow): BoothItem => ({ id: r.id, name: r.name, price: Number(r.price), cost: Number(r.cost), qty: r.qty });

const g = globalThis as unknown as { __memBooth?: { sessions: BoothSession[]; items: (BoothItem & { sessionId: string; createdAt: string })[] } };
const mem = () => (g.__memBooth ??= { sessions: [], items: [] });

function backend(): "db" | "memory" {
  if (isSupabaseConfigured()) return "db";
  if (process.env.NODE_ENV !== "production") return "memory";
  throw new Error("Booth sales aren't available yet: Supabase isn't configured.");
}

function check(error: { message: string } | null, what: string) {
  if (!error) return;
  if (/relation .*booth_|Could not find the table|schema cache/.test(error.message)) {
    throw new Error("The database needs an update: run supabase/migrations/0011_booth_sales.sql in Supabase's SQL Editor.");
  }
  throw new Error(`${what} failed: ${error.message}`);
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function listBoothSessions(): Promise<(BoothSession & { totals: BoothTotals })[]> {
  if (backend() === "memory") {
    const m = mem();
    return m.sessions.map((s) => ({ ...s, totals: boothTotals(m.items.filter((i) => i.sessionId === s.id)) }));
  }
  const db = supabaseAdmin();
  const [sessions, items] = await Promise.all([
    db.from("booth_sessions").select("*").order("day", { ascending: false }).order("created_at", { ascending: false }),
    db.from("booth_items").select("session_id, price, cost, qty"),
  ]);
  check(sessions.error, "Loading booth days");
  check(items.error, "Loading booth items");
  const bySession = new Map<string, ItemRow[]>();
  for (const i of (items.data ?? []) as ItemRow[]) bySession.set(i.session_id, [...(bySession.get(i.session_id) ?? []), i]);
  return ((sessions.data ?? []) as SessionRow[]).map((s) => ({
    ...sessionFrom(s),
    totals: boothTotals((bySession.get(s.id) ?? []).map(itemFrom)),
  }));
}

export async function getBoothSession(id: string): Promise<{ session: BoothSession; items: BoothItem[] } | undefined> {
  if (!isUuid(id)) return undefined;
  if (backend() === "memory") {
    const m = mem();
    const session = m.sessions.find((s) => s.id === id);
    return session ? { session, items: m.items.filter((i) => i.sessionId === id).map(({ id, name, price, cost, qty }) => ({ id, name, price, cost, qty })) } : undefined;
  }
  const db = supabaseAdmin();
  const [s, items] = await Promise.all([
    db.from("booth_sessions").select("*").eq("id", id).maybeSingle(),
    db.from("booth_items").select("*").eq("session_id", id).order("created_at"),
  ]);
  check(s.error, "Loading the booth day");
  check(items.error, "Loading booth items");
  return s.data ? { session: sessionFrom(s.data as SessionRow), items: ((items.data ?? []) as ItemRow[]).map(itemFrom) } : undefined;
}

export async function createBoothSession(name: string, day: string): Promise<BoothSession> {
  if (backend() === "memory") {
    const s: BoothSession = { id: randomUUID(), name, day, createdAt: new Date().toISOString() };
    mem().sessions.unshift(s);
    return s;
  }
  const { data, error } = await supabaseAdmin().from("booth_sessions").insert({ name, day }).select("*").single();
  check(error, "Starting the booth day");
  return sessionFrom(data as SessionRow);
}

export async function deleteBoothSession(id: string): Promise<void> {
  if (backend() === "memory") {
    const m = mem();
    m.sessions = m.sessions.filter((s) => s.id !== id);
    m.items = m.items.filter((i) => i.sessionId !== id);
    return;
  }
  const { error } = await supabaseAdmin().from("booth_sessions").delete().eq("id", id);
  check(error, "Deleting the booth day");
}

/** Saves an item exactly as given (so sending the same change twice is harmless). */
export async function upsertBoothItem(sessionId: string, item: BoothItem): Promise<void> {
  if (backend() === "memory") {
    const m = mem();
    if (!m.sessions.some((s) => s.id === sessionId)) throw new Error("That booth day no longer exists.");
    const i = m.items.findIndex((x) => x.id === item.id);
    if (i >= 0) m.items[i] = { ...m.items[i], ...item };
    else m.items.push({ ...item, sessionId, createdAt: new Date().toISOString() });
    return;
  }
  const { error } = await supabaseAdmin()
    .from("booth_items")
    .upsert({ id: item.id, session_id: sessionId, name: item.name, price: item.price, cost: item.cost, qty: item.qty }, { onConflict: "id" });
  check(error, "Saving the item");
}

export async function deleteBoothItem(sessionId: string, id: string): Promise<void> {
  if (backend() === "memory") {
    const m = mem();
    m.items = m.items.filter((i) => !(i.id === id && i.sessionId === sessionId));
    return;
  }
  const { error } = await supabaseAdmin().from("booth_items").delete().eq("id", id).eq("session_id", sessionId);
  check(error, "Removing the item");
}

export interface BoothSuggestion {
  name: string;
  price: number;
  cost?: number;
}

/** What she has sold before (most recent price and cost), so repeat items fill themselves in. */
export async function pastBoothItems(): Promise<BoothSuggestion[]> {
  try {
    let rows: { name: string; price: number; cost: number }[];
    if (backend() === "memory") {
      rows = [...mem().items].reverse();
    } else {
      const { data, error } = await supabaseAdmin().from("booth_items").select("name, price, cost, created_at").order("created_at", { ascending: false }).limit(500);
      if (error) return [];
      rows = (data ?? []).map((r) => ({ name: r.name, price: Number(r.price), cost: Number(r.cost) }));
    }
    const seen = new Map<string, BoothSuggestion>();
    for (const r of rows) if (!seen.has(r.name.toLowerCase())) seen.set(r.name.toLowerCase(), { name: r.name, price: r.price, cost: r.cost });
    return [...seen.values()];
  } catch {
    return [];
  }
}
