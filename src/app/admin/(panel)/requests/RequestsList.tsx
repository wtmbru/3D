"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { linkHost, parseLink, requestLabel, type CustomRequest, type RequestStatus } from "@/lib/requests";
import { formatPrice } from "@/lib/pricing";
import { When } from "../orders/badges";
import { RequestBadge } from "./badges";

type Filter = "open" | RequestStatus | "all";

const FILTERS: { id: Filter; label: string; test: (r: CustomRequest) => boolean }[] = [
  { id: "open", label: "Needs attention", test: (r) => r.status === "new" },
  { id: "quoted", label: "Quoted", test: (r) => r.status === "quoted" },
  { id: "accepted", label: "Accepted", test: (r) => r.status === "accepted" },
  { id: "declined", label: "Declined", test: (r) => r.status === "declined" },
  { id: "all", label: "All", test: () => true },
];

export function RequestsList({ requests }: { requests: CustomRequest[] }) {
  const [filter, setFilter] = useState<Filter>(requests.some((r) => r.status === "new") ? "open" : "all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, requests.filter(f.test).length])), [requests]);
  const shown = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)!.test;
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return requests.filter((r) => test(r) && (!q || [String(r.number), r.name, r.email, r.phone, r.message, r.modelUrl].some((v) => v.toLowerCase().includes(q))));
  }, [requests, filter, query]);

  if (requests.length === 0) {
    return (
      <div className="chunky layer-lines mt-8 rounded-[36px] bg-sun-soft px-6 py-16 text-center">
        <p className="text-5xl" aria-hidden="true">🔗</p>
        <h2 className="mt-4 font-display text-3xl font-extrabold">No requests yet</h2>
        <p className="mt-2 text-ink-soft">
          When a customer sends a link from the <strong>Custom print</strong> page, it shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter requests">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`chip focus-ring ${filter === f.id ? "bg-ink text-cream" : ""}`}
            >
              {f.label}
              <span className={filter === f.id ? "text-cream/60" : "text-ink-soft"}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="admin-input ml-auto w-full py-1.5 sm:w-64"
          placeholder="Search name, number, message…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search requests"
        />
      </div>

      <ul className="mt-4 divide-y-2 divide-ink/10 overflow-hidden rounded-3xl border-2 border-ink bg-paper">
        {shown.map((r) => (
          <li key={r.id}>
            <Link
              href={`/admin/requests/${r.id}`}
              className={`focus-ring flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-cream ${r.status === "new" ? "bg-sun-soft/40" : ""}`}
            >
              <div className="w-24 shrink-0">
                <p className="font-display text-lg font-extrabold">{requestLabel(r.number)}</p>
                <When iso={r.createdAt} className="text-xs text-ink-soft" />
              </div>
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate font-display font-bold">{r.name}</p>
                <p className="truncate text-sm text-ink-soft">
                  {linkHost(r.modelUrl)}
                  {r.quantity > 1 && ` · ×${r.quantity}`} · {r.message.replace(/\s+/g, " ")}
                </p>
              </div>
              {parseLink(r.modelUrl)?.isMakerWorld === false && (
                <span className="chip bg-cream-deep px-2 py-0 text-xs" title="Not a MakerWorld link">
                  other site
                </span>
              )}
              {r.quotePrice !== undefined && (
                <span className="w-20 text-right font-display font-bold tabular-nums">{formatPrice(r.quotePrice * r.quantity)}</span>
              )}
              <RequestBadge status={r.status} />
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="p-8 text-center text-ink-soft">Nothing here.</li>}
      </ul>
    </div>
  );
}
