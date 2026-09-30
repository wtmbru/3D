"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { swatchBackground } from "@/components/Swatch";
import { useCatalog } from "@/components/CatalogProvider";
import { isOpen, itemCount, orderLabel, paymentLabel, type Order } from "@/lib/orders";
import { formatPrice, getFilament } from "@/lib/pricing";
import { PaymentBadge, StatusBadge, When } from "./badges";

type Filter = "active" | "unpaid" | "completed" | "cancelled" | "all";

const FILTERS: { id: Filter; label: string; test: (o: Order) => boolean }[] = [
  { id: "active", label: "Active", test: isOpen },
  { id: "unpaid", label: "Needs payment", test: (o) => o.paymentStatus === "unpaid" && o.status !== "cancelled" },
  { id: "completed", label: "Completed", test: (o) => o.status === "completed" },
  { id: "cancelled", label: "Cancelled", test: (o) => o.status === "cancelled" },
  { id: "all", label: "All", test: () => true },
];

export function OrdersList({ orders }: { orders: Order[] }) {
  const catalog = useCatalog();
  const [filter, setFilter] = useState<Filter>(orders.some(isOpen) ? "active" : "all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, orders.filter(f.test).length])), [orders]);
  const shown = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)!.test;
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return orders.filter(
      (o) => test(o) && (!q || [String(o.number), o.name, o.email, o.phone].some((v) => v.toLowerCase().includes(q))),
    );
  }, [orders, filter, query]);

  if (orders.length === 0) {
    return (
      <div className="chunky layer-lines mt-8 rounded-[36px] bg-sun-soft px-6 py-16 text-center">
        <p className="text-5xl" aria-hidden="true">📭</p>
        <h2 className="mt-4 font-display text-3xl font-extrabold">No orders yet</h2>
        <p className="mt-2 text-ink-soft">When a customer places an order, it shows up here.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter orders">
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
          placeholder="Search name, number, phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search orders"
        />
      </div>

      <ul className="mt-4 divide-y-2 divide-ink/10 overflow-hidden rounded-3xl border-2 border-ink bg-paper">
        {shown.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/orders/${o.id}`}
              className={`focus-ring flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-cream ${
                o.status === "new" ? "bg-sun-soft/40" : ""
              }`}
            >
              <div className="w-24 shrink-0">
                <p className="font-display text-lg font-extrabold">{orderLabel(o.number)}</p>
                <When iso={o.createdAt} className="text-xs text-ink-soft" />
              </div>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-display font-bold">{o.name}</p>
                <p className="truncate text-sm text-ink-soft">
                  {itemCount(o)} {itemCount(o) === 1 ? "item" : "items"} · {paymentLabel(o.payment)} · {o.delivery === "shipping" ? "Ship 📦" : "Pickup"}
                </p>
              </div>
              <div className="hidden -space-x-1.5 md:flex" aria-hidden="true">
                {[...new Set(o.items.flatMap((i) => i.parts.map((p) => p.filamentId)))].slice(0, 5).map((id) => {
                  const f = getFilament(catalog, id);
                  return f && <span key={id} className="h-5 w-5 rounded-full border-2 border-ink" style={swatchBackground(f)} />;
                })}
              </div>
              <span className="w-16 text-right font-display font-bold tabular-nums">{formatPrice(o.total)}</span>
              <div className="flex gap-1.5">
                <PaymentBadge status={o.paymentStatus} />
                <StatusBadge status={o.status} />
              </div>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="p-8 text-center text-ink-soft">Nothing here.</li>}
      </ul>
    </div>
  );
}
