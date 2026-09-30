"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { trackOrders } from "@/app/(store)/track/actions";
import type { TrackResult } from "@/lib/lookup";
import { formatPrice } from "@/lib/pricing";
import { useHydrated } from "@/lib/useHydrated";

export function TrackForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TrackResult[] | null>(null);
  const ready = useHydrated();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setResults(null);
    start(async () => {
      const res = await trackOrders({
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        name: String(form.get("name") ?? ""),
        website: String(form.get("website") ?? ""),
      });
      if (res.ok) setResults(res.results);
      else setError(res.error);
    });
  }

  return (
    <div className="mt-10 max-w-xl">
      <form method="post" onSubmit={submit} className="chunky rounded-[var(--radius-blob)] bg-paper p-6 sm:p-8">
        <label className="block">
          <span className="admin-label">Email</span>
          <input name="email" type="email" autoComplete="email" required className="admin-input" />
        </label>
        <p className="mt-5 text-sm font-semibold text-ink-soft">…and at least one of these:</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="admin-label">Phone</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" className="admin-input" />
          </label>
          <label className="block">
            <span className="admin-label">Name</span>
            <input name="name" autoComplete="name" className="admin-input" />
          </label>
        </div>
        <p className="admin-hint">Use the same details you gave when you ordered. If you fill in both, both have to match.</p>
        {/* Honeypot: invisible to people, tempting to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-5" disabled={pending || !ready}>
          {pending ? "Looking…" : "Find my orders"}
        </button>
      </form>

      {results && (
        <section className="mt-8" aria-live="polite" aria-label="Results">
          {results.length === 0 ? (
            <div className="chunky rounded-[var(--radius-blob)] bg-sun-soft p-6">
              <h2 className="font-display text-2xl font-extrabold">We couldn&apos;t find a match</h2>
              <p className="mt-2 text-sm">Check the spelling of your email, and try the phone number or name exactly as you entered it.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {results.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <Link
                    href={`/${r.kind}/${r.id}`}
                    className="chunky focus-ring flex items-center justify-between gap-4 rounded-[var(--radius-blob)] bg-paper p-5 transition-transform hover:-translate-y-0.5"
                  >
                    <span>
                      <span className="block text-xs font-bold tracking-wide text-ink-soft uppercase">
                        {r.kind === "order" ? "Order" : "Custom request"} {r.label}
                      </span>
                      <span className="mt-0.5 block font-display text-lg font-extrabold">{r.status}</span>
                      <span className="block text-sm text-ink-soft">
                        {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                      </span>
                    </span>
                    <span className="font-display text-xl font-extrabold tabular-nums">{r.total !== undefined ? formatPrice(r.total) : "→"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
