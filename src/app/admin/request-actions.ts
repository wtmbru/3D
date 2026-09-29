"use server";

import { z } from "zod";
import { REQUEST_STATUSES } from "@/lib/requests";
import { fail, run, type RunResult } from "@/lib/server/admin-run";
import { deleteRequest, updateRequest } from "@/lib/server/requests";

const idSchema = z.string().uuid();
const statusSchema = z.enum(REQUEST_STATUSES.map((s) => s.id) as [string, ...string[]]);

export async function setRequestStatus(id: string, status: string): Promise<RunResult> {
  return run(async () => {
    const r = await updateRequest(idSchema.parse(id), { status: statusSchema.parse(status) as never });
    if (!r) return fail("That request no longer exists.");
  });
}

/** Save her price and note, and mark the request as quoted. */
export async function sendQuote(id: string, price: number, note: string): Promise<RunResult> {
  return run(async () => {
    const parsed = z
      .object({
        price: z.number().finite().min(0, "The price can't be negative.").max(100_000, "That price looks too high."),
        note: z.string().max(2000, "Please keep the note under 2,000 characters."),
      })
      .safeParse({ price, note });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the price.");
    const r = await updateRequest(idSchema.parse(id), {
      quotePrice: Math.round(parsed.data.price * 100) / 100,
      quoteNote: parsed.data.note.trim(),
      status: "quoted",
    });
    if (!r) return fail("That request no longer exists.");
  });
}

export async function saveRequestNotes(id: string, notes: string): Promise<RunResult> {
  return run(async () => {
    const r = await updateRequest(idSchema.parse(id), { adminNotes: z.string().max(4000).parse(notes).trim() });
    if (!r) return fail("That request no longer exists.");
  });
}

export async function removeRequest(id: string): Promise<RunResult> {
  return run(async () => deleteRequest(idSchema.parse(id)));
}
