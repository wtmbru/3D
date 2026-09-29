import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";

export type RunResult = { ok: true } | { ok: false; error: string };
export const fail = (error: string) => ({ ok: false as const, error });

/**
 * Wrapper for admin-only server actions: checks the session (actions are
 * public endpoints, so each one must), turns errors into friendly messages,
 * and refreshes the admin pages afterwards.
 */
export async function run(fn: () => Promise<RunResult | void>): Promise<RunResult> {
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
