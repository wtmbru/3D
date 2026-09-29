"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ITEM_STATUSES, ORDER_STATUSES, PAYMENT_STATUSES, statusAfterItemChange } from "@/lib/orders";
import { requireAdmin } from "@/lib/server/auth";
import { deleteOrder, getOrderById, savePaymentSettings, setItemStatus, updateOrder } from "@/lib/server/orders";
import type { ActionResult } from "./actions";

const fail = (error: string) => ({ ok: false as const, error });

/** Admin-only wrapper: checks the session, turns errors into friendly messages, refreshes the admin pages. */
async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Your session expired. Please sign in again.");
  }
  try {
    const res = await fn();
    if (res && !res.ok) return res;
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

const idSchema = z.string().uuid();
const statusSchema = z.enum(ORDER_STATUSES.map((s) => s.id) as [string, ...string[]]);
const paymentSchema = z.enum(PAYMENT_STATUSES.map((s) => s.id) as [string, ...string[]]);
const itemStatusSchema = z.enum(ITEM_STATUSES.map((s) => s.id) as [string, ...string[]]);

export async function setOrderStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const order = await updateOrder(idSchema.parse(id), { status: statusSchema.parse(status) as never });
    if (!order) return fail("That order no longer exists.");
  });
}

export async function setPaymentStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const order = await updateOrder(idSchema.parse(id), { paymentStatus: paymentSchema.parse(status) as never });
    if (!order) return fail("That order no longer exists.");
  });
}

export async function setOrderItemStatus(id: string, itemId: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const order = await getOrderById(idSchema.parse(id));
    if (!order) return fail("That order no longer exists.");
    const items = setItemStatus(order.items, itemId, itemStatusSchema.parse(status) as never);
    // Starting a print moves the order to Printing; finishing every item moves it to Ready.
    await updateOrder(order.id, { items, status: statusAfterItemChange(order.status, items) });
  });
}

export async function saveOrderNotes(id: string, notes: string): Promise<ActionResult> {
  return run(async () => {
    const order = await updateOrder(idSchema.parse(id), { adminNotes: z.string().max(4000).parse(notes).trim() });
    if (!order) return fail("That order no longer exists.");
  });
}

export async function removeOrder(id: string): Promise<ActionResult> {
  return run(async () => deleteOrder(idSchema.parse(id)));
}

const paymentSettingsSchema = z.object({
  zelle: z.string().trim().max(80),
  venmo: z.string().trim().max(80),
  cashapp: z.string().trim().max(80),
  note: z.string().trim().max(300),
});

export async function savePayments(input: z.input<typeof paymentSettingsSchema>): Promise<ActionResult> {
  return run(async () => {
    const parsed = paymentSettingsSchema.safeParse(input);
    if (!parsed.success) return fail("Those payment details look too long.");
    await savePaymentSettings(parsed.data);
  });
}
