"use server";

import { z } from "zod";
import { fail, run, type RunResult } from "@/lib/server/admin-run";
import { saveSetting } from "@/lib/server/settings";

const schema = z.object({
  shippingFee: z.number().finite().min(0, "The shipping fee can't be negative.").max(1000, "That shipping fee looks too high."),
  pickupNote: z.string().trim().max(300, "Please keep the pickup note under 300 characters."),
});

export async function saveDelivery(input: z.input<typeof schema>): Promise<RunResult> {
  return run(async () => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check those details.");
    await saveSetting("delivery", { ...parsed.data, shippingFee: Math.round(parsed.data.shippingFee * 100) / 100 });
  });
}
