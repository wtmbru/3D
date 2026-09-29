import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";

/*
 * Small shop settings stored as one JSON row per key in the `settings` table
 * (e.g. the homepage hero). Reads never throw: a missing table or a database
 * hiccup just means "use the default". Without Supabase (local development)
 * they live in memory.
 */

const g = globalThis as unknown as { __memSettings?: Map<string, unknown> };
const memory = () => (g.__memSettings ??= new Map());

export async function getSetting<T extends object>(key: string, fallback: T): Promise<T> {
  try {
    if (!isSupabaseConfigured()) return { ...fallback, ...(memory().get(key) as Partial<T> | undefined) };
    const { data } = await supabaseAdmin().from("settings").select("value").eq("key", key).maybeSingle();
    return { ...fallback, ...(data?.value as Partial<T> | undefined) };
  } catch {
    return fallback;
  }
}

export async function saveSetting(key: string, value: object): Promise<void> {
  if (!isSupabaseConfigured()) {
    memory().set(key, value);
    return;
  }
  const { error } = await supabaseAdmin().from("settings").upsert({ key, value });
  if (error) {
    if (/relation|schema cache|Could not find the table/.test(error.message)) {
      throw new Error("The database needs an update: run supabase/migrations/0003_orders.sql in Supabase's SQL Editor.");
    }
    throw new Error(`Saving the setting failed: ${error.message}`);
  }
}

export interface HomeSettings {
  /** The product shown big at the top of the homepage; null = automatic. */
  heroProductId: string | null;
}

export const getHomeSettings = () => getSetting<HomeSettings>("home", { heroProductId: null });
