"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { boothItemSchema, boothSessionSchema } from "@/lib/booth";
import { fail, run, type RunResult } from "@/lib/server/admin-run";
import { requireAdmin } from "@/lib/server/auth";
import { createBoothSession, deleteBoothItem, deleteBoothSession, upsertBoothItem } from "@/lib/server/booth";

const idSchema = z.string().uuid();

/** Start a booth day. Returns its id so the page can open it. */
export async function startBoothDay(input: z.input<typeof boothSessionSchema>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return fail("Your session expired. Please sign in again.");
  }
  const parsed = boothSessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check those details.");
  try {
    const s = await createBoothSession(parsed.data.name, parsed.data.day);
    revalidatePath("/admin/booth");
    return { ok: true, id: s.id };
  } catch (e) {
    console.error(e);
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function removeBoothDay(id: string): Promise<RunResult> {
  return run(async () => deleteBoothSession(idSchema.parse(id)));
}

/**
 * The item actions skip the usual "refresh every admin page" step: they run on every tap at the
 * booth, and re-rendering the page each time would be slow on a weak signal.
 */
async function lightRun(fn: () => Promise<void | RunResult>): Promise<RunResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Your session expired. Please sign in again.");
  }
  try {
    const res = await fn();
    return res && !res.ok ? res : { ok: true };
  } catch (e) {
    console.error(e);
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

/**
 * Save an item as it is right now (name, price, cost and quantity). Sending the same thing twice
 * is harmless, which is what lets the booth page retry safely when the signal drops.
 */
export async function saveBoothItem(sessionId: string, item: z.input<typeof boothItemSchema>): Promise<RunResult> {
  return lightRun(async () => {
    const parsed = boothItemSchema.safeParse(item);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check that item.");
    await upsertBoothItem(idSchema.parse(sessionId), parsed.data);
  });
}

export async function removeBoothItem(sessionId: string, id: string): Promise<RunResult> {
  return lightRun(async () => deleteBoothItem(idSchema.parse(sessionId), idSchema.parse(id)));
}
