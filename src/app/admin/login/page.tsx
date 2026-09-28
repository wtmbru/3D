import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { isAdmin } from "@/lib/server/auth";
import { isAdminConfigured } from "@/lib/server/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function LoginPage() {
  const configured = isAdminConfigured();
  if (configured && (await isAdmin())) redirect("/admin");

  return (
    <main className="layer-lines grid min-h-dvh place-items-center bg-cream px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="chunky rounded-[var(--radius-blob)] bg-paper p-6 shadow-[var(--shadow-pop-lg)]">
          <h1 className="font-display text-2xl font-extrabold">Shop admin</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to manage products and filaments.</p>
          {configured ? (
            <LoginForm />
          ) : (
            <div className="mt-5 rounded-2xl bg-sun-soft p-4 text-sm">
              <p className="font-bold">Admin login isn&apos;t set up yet.</p>
              <p className="mt-2">
                Add these to <code className="rounded bg-paper px-1">.env.local</code> (and to your
                hosting environment), then restart:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-ink p-3 text-xs text-cream">
{`ADMIN_PASSWORD=choose-a-long-password
ADMIN_SESSION_SECRET=<32+ random characters>`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
