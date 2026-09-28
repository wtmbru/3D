import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** For admin pages: bounce to the login screen when not signed in. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

/**
 * For server actions. Actions are public HTTP endpoints, so each one must
 * check the session itself — the proxy only guards page navigation.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not signed in");
}

// ── Login throttling ─────────────────────────────────────────────────────────

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 8;
const memoryAttempts = new Map<string, number[]>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** True if this IP has failed too many times recently. */
export async function isThrottled(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  if (isSupabaseConfigured()) {
    const { count } = await supabaseAdmin()
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("succeeded", false)
      .gte("attempted_at", since.toISOString());
    return (count ?? 0) >= MAX_FAILURES;
  }
  // Fallback for local dev without a database (per server instance only).
  const recent = (memoryAttempts.get(ip) ?? []).filter((t) => t > since.getTime());
  memoryAttempts.set(ip, recent);
  return recent.length >= MAX_FAILURES;
}

export async function recordAttempt(ip: string, succeeded: boolean): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabaseAdmin().from("admin_login_attempts").insert({ ip, succeeded });
    return;
  }
  if (!succeeded) memoryAttempts.set(ip, [...(memoryAttempts.get(ip) ?? []), Date.now()]);
}
