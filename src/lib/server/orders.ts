import "server-only";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { finishLabels } from "@/data/constants";
import { defaultsFor } from "@/lib/config";
import {
  EMPTY_PAYMENT_SETTINGS,
  type ItemStatus,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentMethod,
  type PaymentSettings,
  type PaymentStatus,
} from "@/lib/orders";
import { getFilament, MAX_QTY, platesOverLimit, quote } from "@/lib/pricing";
import type { AddonSelection, Catalog, ColorConfig, MaterialFamily, Product } from "@/lib/types";
import { hasOptions, normalizeAddons, resolveVariant, variantsOf } from "@/lib/variants";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";

/*
 * Orders live in Supabase. When Supabase isn't configured, local development
 * falls back to an in-memory store so the whole flow can be tried offline
 * (it vanishes on restart). Production never uses the fallback.
 */

// ── Building an order from a cart ────────────────────────────────────────────

export interface CartInput {
  slug: string;
  variant?: string;
  family: MaterialFamily;
  config: ColorConfig;
  addons?: AddonSelection;
  qty: number;
}

/**
 * Turn cart lines into order items using the *current catalog*: the price,
 * names and colors come from here, never from what the browser sent. Anything
 * that no longer checks out (unpublished product, out-of-stock color…)
 * returns a message the customer can act on.
 */
export function buildOrderItems(
  catalog: Catalog,
  products: Product[],
  cart: CartInput[],
): { ok: true; items: OrderItem[]; total: number } | { ok: false; error: string } {
  const items: OrderItem[] = [];
  for (const line of cart) {
    const full = products.find((p) => p.slug === line.slug);
    if (!full) return { ok: false, error: "An item in your cart is no longer available. Please remove it and try again." };

    const options = variantsOf(full);
    const variant = line.variant ? options.find((v) => v.id === line.variant) : options.length === 1 ? options[0] : undefined;
    if (!variant) return { ok: false, error: `Please choose an option again for ${full.name}.` };
    const product = resolveVariant(full, variant.id);

    if (!product.materials.includes(line.family)) {
      return { ok: false, error: `${full.name} isn't available in ${line.family}.` };
    }
    const qty = Math.trunc(line.qty);
    if (!(qty >= 1 && qty <= MAX_QTY)) return { ok: false, error: "Please check the quantities in your cart." };

    // Locked parts always use their default color; the others must be valid, in-stock filament.
    const defaults = defaultsFor(catalog, product, line.family);
    const config: ColorConfig = {};
    for (const part of product.parts) {
      const id = part.locked ? defaults[part.id] : (line.config[part.id] ?? defaults[part.id]);
      const f = getFilament(catalog, id);
      if (!f || f.family !== line.family) {
        return { ok: false, error: `A color on ${full.name} isn't available in ${line.family}. Please edit that item.` };
      }
      if (!f.inStock) {
        return { ok: false, error: `${f.name} is out of stock right now. Please edit the colors on ${full.name}.` };
      }
      config[part.id] = id;
    }
    if (platesOverLimit(product, config).length) {
      return { ok: false, error: `${full.name} uses too many colors in one print. Please edit that item.` };
    }

    const addons = normalizeAddons(full, line.addons ?? {});
    const unitPrice = quote(catalog, product, line.family, config, addons).unit;

    items.push({
      id: randomUUID(),
      productId: full.id,
      slug: full.slug,
      name: full.name,
      ...(hasOptions(full) ? { variantId: variant.id, variantName: variant.name } : {}),
      family: line.family,
      qty,
      unitPrice,
      config,
      parts: product.parts.map((part) => {
        const f = getFilament(catalog, config[part.id])!;
        return {
          id: part.id,
          name: part.name,
          ...(part.plate && part.plate > 1 ? { plate: part.plate } : {}),
          filamentId: f.id,
          filamentName: f.name,
          finish: f.finish,
          hex: f.hex,
          ...(f.hex2 ? { hex2: f.hex2 } : {}),
        };
      }),
      addons: (full.addons ?? []).flatMap((g) => {
        const c = g.choices.find((x) => x.id === addons[g.id]);
        return c && c !== g.choices[0] ? [`${g.name}: ${c.name}`] : [];
      }),
      status: "queued",
    });
  }
  const total = Math.round(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0) * 100) / 100;
  return { ok: true, items, total };
}

/** "Sunflower · Basic" style text for a part's filament. */
export const filamentText = (p: OrderItem["parts"][number]) => `${p.filamentName} · ${finishLabels[p.finish]}`;

// ── Storage ──────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  number: number;
  created_at: string;
  customer_name: string;
  email: string;
  phone: string;
  payment_method: PaymentMethod;
  notes: string | null;
  items: OrderItem[];
  total: string | number;
  payment_status: PaymentStatus;
  status: OrderStatus;
  admin_notes: string | null;
  paid_at: string | null;
  completed_at: string | null;
};

const fromRow = (r: Row): Order => ({
  id: r.id,
  number: r.number,
  createdAt: r.created_at,
  name: r.customer_name,
  email: r.email,
  phone: r.phone,
  payment: r.payment_method,
  ...(r.notes ? { notes: r.notes } : {}),
  items: r.items,
  total: Number(r.total),
  paymentStatus: r.payment_status,
  status: r.status,
  ...(r.admin_notes ? { adminNotes: r.admin_notes } : {}),
  ...(r.paid_at ? { paidAt: r.paid_at } : {}),
  ...(r.completed_at ? { completedAt: r.completed_at } : {}),
});

export interface NewOrder {
  name: string;
  email: string;
  phone: string;
  payment: PaymentMethod;
  notes?: string;
  items: OrderItem[];
  total: number;
  ipHash?: string;
}

/** Fields an admin may change. */
export type OrderPatch = Partial<Pick<Order, "status" | "paymentStatus" | "adminNotes" | "items">>;

const g = globalThis as unknown as { __memOrders?: { orders: (Order & { ipHash?: string })[]; seq: number; settings: PaymentSettings } };
function mem() {
  g.__memOrders ??= { orders: [], seq: 1000, settings: { ...EMPTY_PAYMENT_SETTINGS } };
  return g.__memOrders;
}

/** Real database, or the dev-only in-memory store. Production without Supabase can't take orders. */
function backend(): "db" | "memory" {
  if (isSupabaseConfigured()) return "db";
  if (process.env.NODE_ENV !== "production") return "memory";
  throw new Error("Orders aren't available yet: Supabase isn't configured.");
}

function throwIfError(error: { message: string } | null, what: string) {
  if (!error) return;
  if (/relation .*orders|Could not find the table|schema cache/.test(error.message)) {
    throw new Error("The database needs an update: run supabase/migrations/0003_orders.sql in Supabase's SQL Editor.");
  }
  throw new Error(`${what} failed: ${error.message}`);
}

export async function insertOrder(o: NewOrder): Promise<Order> {
  if (backend() === "memory") {
    const m = mem();
    const order: Order & { ipHash?: string } = {
      id: randomUUID(),
      number: ++m.seq,
      createdAt: new Date().toISOString(),
      name: o.name,
      email: o.email,
      phone: o.phone,
      payment: o.payment,
      ...(o.notes ? { notes: o.notes } : {}),
      items: o.items,
      total: o.total,
      paymentStatus: "unpaid",
      status: "new",
      ipHash: o.ipHash,
    };
    m.orders.unshift(order);
    return order;
  }
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .insert({
      customer_name: o.name,
      email: o.email,
      phone: o.phone,
      payment_method: o.payment,
      notes: o.notes || null,
      items: o.items,
      total: o.total,
      ip_hash: o.ipHash ?? null,
    })
    .select("*")
    .single();
  throwIfError(error, "Saving the order");
  return fromRow(data as Row);
}

export async function listOrders(limit = 500): Promise<Order[]> {
  if (backend() === "memory") return mem().orders.slice(0, limit);
  const { data, error } = await supabaseAdmin().from("orders").select("*").order("created_at", { ascending: false }).limit(limit);
  throwIfError(error, "Loading orders");
  return (data as Row[]).map(fromRow);
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  // Only real UUIDs can match; skip the query for anything else.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return undefined;
  if (backend() === "memory") return mem().orders.find((o) => o.id === id);
  const { data, error } = await supabaseAdmin().from("orders").select("*").eq("id", id).maybeSingle();
  throwIfError(error, "Loading the order");
  return data ? fromRow(data as Row) : undefined;
}

export async function updateOrder(id: string, patch: OrderPatch): Promise<Order | undefined> {
  const now = new Date().toISOString();
  if (backend() === "memory") {
    const o = mem().orders.find((x) => x.id === id);
    if (!o) return undefined;
    Object.assign(o, patch);
    if (patch.paymentStatus) o.paidAt = patch.paymentStatus === "paid" ? (o.paidAt ?? now) : undefined;
    if (patch.status) o.completedAt = patch.status === "completed" ? (o.completedAt ?? now) : undefined;
    return o;
  }
  const row: Record<string, unknown> = {};
  if (patch.status) {
    row.status = patch.status;
    row.completed_at = patch.status === "completed" ? now : null;
  }
  if (patch.paymentStatus) {
    row.payment_status = patch.paymentStatus;
    row.paid_at = patch.paymentStatus === "paid" ? now : null;
  }
  if (patch.adminNotes !== undefined) row.admin_notes = patch.adminNotes || null;
  if (patch.items) row.items = patch.items;
  const { data, error } = await supabaseAdmin().from("orders").update(row).eq("id", id).select("*").maybeSingle();
  throwIfError(error, "Updating the order");
  return data ? fromRow(data as Row) : undefined;
}

export async function deleteOrder(id: string): Promise<void> {
  if (backend() === "memory") {
    const m = mem();
    m.orders = m.orders.filter((o) => o.id !== id);
    return;
  }
  const { error } = await supabaseAdmin().from("orders").delete().eq("id", id);
  throwIfError(error, "Deleting the order");
}

export async function countNewOrders(): Promise<number> {
  try {
    if (backend() === "memory") return mem().orders.filter((o) => o.status === "new").length;
    const { count } = await supabaseAdmin().from("orders").select("id", { count: "exact", head: true }).eq("status", "new");
    return count ?? 0;
  } catch {
    return 0; // the nav badge must never break an admin page
  }
}

/** How many orders came from this (hashed) address recently: a spam brake. */
export async function countRecentOrders(ipHash: string, sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  if (backend() === "memory") return mem().orders.filter((o) => o.ipHash === ipHash && o.createdAt >= since).length;
  const { count, error } = await supabaseAdmin()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  throwIfError(error, "Checking recent orders");
  return count ?? 0;
}

export function setItemStatus(items: OrderItem[], itemId: string, status: ItemStatus): OrderItem[] {
  return items.map((i) => (i.id === itemId ? { ...i, status } : i));
}

// ── Payment settings (her Zelle / Venmo / Cash App handles) ─────────────────

export const getPaymentSettings = cache(async (): Promise<PaymentSettings> => {
  try {
    if (backend() === "memory") return mem().settings;
    const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "payments").maybeSingle();
    return { ...EMPTY_PAYMENT_SETTINGS, ...(data?.value as Partial<PaymentSettings> | undefined) };
  } catch {
    return EMPTY_PAYMENT_SETTINGS; // e.g. migration not run yet: checkout still works, just without handles
  }
});

export async function savePaymentSettings(s: PaymentSettings): Promise<void> {
  if (backend() === "memory") {
    mem().settings = s;
    return;
  }
  const { error } = await supabaseAdmin().from("settings").upsert({ key: "payments", value: s });
  throwIfError(error, "Saving settings");
}
