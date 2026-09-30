"use server";

import { z } from "zod";
import { fail, run, type RunResult } from "@/lib/server/admin-run";
import { saveSetting } from "@/lib/server/settings";

const price = z.number().finite().min(0, "Prices can't be negative.").max(1000, "That price per kilo looks too high.");
const schema = z.object({
  perKg: z.object({ PLA: price, PETG: price, TPU: price }),
  solidPct: z.number().finite().min(1, "Solid % must be between 1 and 100.").max(100, "Solid % must be between 1 and 100."),
  wastePct: z.number().finite().min(0, "Waste % must be between 0 and 100.").max(100, "Waste % must be between 0 and 100."),
});

export async function saveCosts(input: z.input<typeof schema>): Promise<RunResult> {
  return run(async () => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check those numbers.");
    await saveSetting("costs", parsed.data);
  });
}
