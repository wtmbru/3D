"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDay, sumTotals, todayLocal, type BoothSession, type BoothTotals } from "@/lib/booth";
import { formatPrice } from "@/lib/pricing";
import { useHydrated } from "@/lib/useHydrated";
import { removeBoothDay, startBoothDay } from "../../booth-actions";
import { Notice, useNotice } from "../ui";

type Row = BoothSession & { totals: BoothTotals };

export function BoothList({ sessions }: { sessions: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useNotice();
  const ready = useHydrated();
  const [name, setName] = useState("");
  const [day, setDay] = useState(todayLocal);
  const all = sumTotals(sessions.map((s) => s.totals));

  function begin(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await startBoothDay({ name: name.trim() || "Booth day", day });
      if (res.ok) router.push(`/admin/booth/${res.id}`);
      else setNotice({ kind: "error", text: res.error });
    });
  }

  function remove(s: Row) {
    if (!confirm(`Delete "${s.name}" and everything sold in it? This can't be undone.`)) return;
    start(async () => {
      const res = await removeBoothDay(s.id);
      if (res.ok) {
        setNotice({ kind: "ok", text: `${s.name} deleted.` });
        router.refresh();
      } else setNotice({ kind: "error", text: res.error });
    });
  }

  return (
    <div className="mt-8 space-y-8">
      <form method="post" onSubmit={begin} className="admin-card max-w-2xl space-y-4">
        <h2 className="admin-h2">Start a booth day</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="admin-label">Name</span>
            <input className="admin-input" value={name} maxLength={120} placeholder="e.g. Saturday market" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="admin-label">Date</span>
            <input className="admin-input" type="date" value={day} required suppressHydrationWarning onChange={(e) => setDay(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending || !ready}>
            {pending ? "Starting…" : "Start selling"}
          </button>
          <Notice notice={notice} />
        </div>
      </form>

      {sessions.length > 0 && (
        <section aria-label="All booth days">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-2xl font-extrabold">Your booth days</h2>
            <p className="text-sm text-ink-soft">
              All time: <strong className="text-ink">{formatPrice(all.sales)}</strong> sales · <strong className="text-ink">{formatPrice(all.profit)}</strong> profit
            </p>
          </div>
          <ul className="mt-4 space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="admin-card flex flex-wrap items-center gap-4">
                <Link href={`/admin/booth/${s.id}`} className="focus-ring min-w-0 flex-1 rounded-lg">
                  <p className="truncate font-display text-lg font-extrabold">{s.name}</p>
                  <p className="text-sm text-ink-soft">
                    {formatDay(s.day)} · {s.totals.units} {s.totals.units === 1 ? "item" : "items"} sold
                  </p>
                </Link>
                <dl className="flex gap-5 text-right text-sm">
                  <div>
                    <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Sales</dt>
                    <dd className="font-display text-lg font-extrabold tabular-nums">{formatPrice(s.totals.sales)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Profit</dt>
                    <dd className="font-display text-lg font-extrabold tabular-nums">{formatPrice(s.totals.profit)}</dd>
                  </div>
                </dl>
                <button type="button" className="btn btn-secondary btn-sm text-tomato" disabled={pending} onClick={() => remove(s)} aria-label={`Delete ${s.name}`}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
