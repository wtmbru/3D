import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "products";

let client: SupabaseClient | null = null;

/** True once SUPABASE_URL and SUPABASE_SECRET_KEY are set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/**
 * Server-only client using the secret (service role) key. It bypasses row
 * level security, so it must never be imported into client code — the
 * "server-only" import above makes that a build error.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function publicFileUrl(path: string): string {
  return supabaseAdmin().storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Inverse of publicFileUrl — undefined for files not in our bucket (e.g. /models samples). */
export function storagePathFromUrl(url: string): string | undefined {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? undefined : decodeURIComponent(url.slice(i + marker.length));
}
