"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { boothTotals, formatDay, type BoothItem, type BoothSession } from "@/lib/booth";
import type { BoothSuggestion } from "@/lib/server/booth";
import { formatPrice } from "@/lib/pricing";
import { removeBoothItem, saveBoothItem } from "../../../booth-actions";

/** A change waiting to reach the server: the item as it should be (null = removed). `v` tells newer changes from the one being sent. */
type Change = { item: BoothItem | null; v: number };

const BUMPS = [1, 2, 3, 5];

export function BoothTracker({ session, initialItems, suggestions }: { session: BoothSession; initialItems: BoothItem[]; suggestions: BoothSuggestion[] }) {
  const storeKey = `filamint-booth-${session.id}`;
  const [items, setItems] = useState<BoothItem[]>(initialItems);
  // Always the latest list, so two quick taps in a row both count.
  const itemsRef = useRef(initialItems);
  const setAll = useCallback((next: BoothItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);
  // Changes not yet saved. Kept in the browser too, so a weak signal (or a reload) can't lose sales.
  const changes = useRef(new Map<string, Change>());
  const [unsaved, setUnsaved] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const sending = useRef(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const persist = useCallback(() => {
    try {
      if (changes.current.size === 0) localStorage.removeItem(storeKey);
      else localStorage.setItem(storeKey, JSON.stringify([...changes.current]));
    } catch {
      // Storage can be blocked; the changes still retry from memory.
    }
    setUnsaved(changes.current.size);
  }, [storeKey]);

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      for (const [id, change] of [...changes.current]) {
        let res: { ok: boolean; error?: string };
        try {
          res = change.item ? await saveBoothItem(session.id, change.item) : await removeBoothItem(session.id, id);
        } catch {
          setProblem("No signal right now. Your sales are safe on this phone and will save when it's back.");
          return;
        }
        if (!res.ok) {
          setProblem(res.error ?? "Couldn't save.");
          return;
        }
        // Only forget it if nothing newer came in while it was being sent.
        if (changes.current.get(id)?.v === change.v) changes.current.delete(id);
        persist();
      }
      setProblem(null);
    } finally {
      sending.current = false;
    }
  }, [session.id, persist]);

  // On opening: bring back anything this phone hadn't managed to save, then try to save it.
  // (Done just after the first render, so what the server sent and what the browser shows agree.)
  useEffect(() => {
    let saved: [string, Change][] = [];
    try {
      saved = JSON.parse(localStorage.getItem(storeKey) ?? "[]");
    } catch {
      saved = [];
    }
    if (saved.length === 0) return;
    queueMicrotask(() => {
      for (const [id, c] of saved) changes.current.set(id, c);
      let next = itemsRef.current;
      for (const [id, c] of saved) next = c.item ? (next.some((i) => i.id === id) ? next.map((i) => (i.id === id ? c.item! : i)) : [...next, c.item]) : next.filter((i) => i.id !== id);
      setAll(next);
      setUnsaved(changes.current.size);
      void flush();
    });
  }, [storeKey, flush, setAll]);

  // Keep trying while anything is unsaved, and as soon as the signal comes back.
  useEffect(() => {
    if (unsaved === 0) return;
    const t = setInterval(() => void flush(), 5000);
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", online);
    };
  }, [unsaved, flush]);

  /** Change one item (or remove it with null): show it now, save it in the background. */
  function change(id: string, next: BoothItem | null) {
    const cur = itemsRef.current;
    setAll(next ? (cur.some((i) => i.id === id) ? cur.map((i) => (i.id === id ? next : i)) : [...cur, next]) : cur.filter((i) => i.id !== id));
    changes.current.set(id, { item: next, v: (changes.current.get(id)?.v ?? 0) + 1 });
    persist();
    void flush();
  }

  const bump = (item: BoothItem, n: number) => {
    const latest = itemsRef.current.find((i) => i.id === item.id) ?? item;
    change(item.id, { ...latest, qty: Math.max(0, latest.qty + n) });
  };
  const totals = boothTotals(items);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/booth" className="text-sm font-semibold text-ink-soft hover:text-ink">
        ← Booth days
      </Link>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{session.name}</h1>
      <p className="text-ink-soft">{formatDay(session.day)}</p>

      <section className="chunky sticky top-[72px] z-30 mt-4 rounded-3xl bg-sun-soft p-4" aria-label="Totals">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Sales" value={formatPrice(totals.sales)} />
          <Stat label="Cost" value={formatPrice(totals.cost)} />
          <Stat label="Profit" value={formatPrice(totals.profit)} strong />
        </dl>
        <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-ink-soft">
          <span>
            {totals.units} {totals.units === 1 ? "item" : "items"} sold
          </span>
          <span role="status" className={unsaved > 0 ? "text-tomato" : ""}>
            {unsaved > 0 ? `⚠ ${unsaved} ${unsaved === 1 ? "change" : "changes"} not saved yet` : "✓ Saved"}
          </span>
        </p>
        {problem && (
          <p role="alert" className="mt-2 rounded-xl bg-tomato-soft px-3 py-2 text-xs font-semibold">
            {problem}
          </p>
        )}
      </section>

      <ul className="mt-5 space-y-3">
        {items.map((item) =>
          editing === item.id ? (
            <li key={item.id}>
              <ItemForm
                title="Edit item"
                initial={item}
                suggestions={[]}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onDelete={() => {
                  if (confirm(`Remove ${item.name}? Its ${item.qty} sold will no longer count.`)) {
                    change(item.id, null);
                    setEditing(null);
                  }
                }}
                onSubmit={(v) => {
                  change(item.id, { ...item, ...v });
                  setEditing(null);
                }}
              />
            </li>
          ) : (
            <li key={item.id} className="chunky rounded-3xl bg-paper p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-extrabold">{item.name}</p>
                  <p className="text-sm text-ink-soft">
                    {formatPrice(item.price)} each · costs {formatPrice(item.cost)} · makes {formatPrice(Math.round((item.price - item.cost) * 100) / 100)}
                  </p>
                </div>
                <button type="button" className="focus-ring rounded-full px-2 py-1 text-sm font-semibold text-ink-soft underline decoration-2 underline-offset-2" onClick={() => setEditing(item.id)}>
                  Edit
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`Remove one ${item.name}`}
                  disabled={item.qty === 0}
                  onClick={() => bump(item, -1)}
                  className="focus-ring h-14 w-14 shrink-0 rounded-2xl border-2 border-ink bg-paper text-2xl font-extrabold disabled:opacity-30"
                >
                  −
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="font-display text-4xl font-extrabold tabular-nums" aria-label={`${item.qty} sold`}>
                    {item.qty}
                  </p>
                  <p className="text-xs font-semibold text-ink-soft">sold · {formatPrice(Math.round(item.price * item.qty * 100) / 100)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {BUMPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Sold ${n} ${item.name}`}
                    onClick={() => bump(item, n)}
                    className="focus-ring h-14 rounded-2xl border-2 border-ink bg-mint text-xl font-extrabold shadow-[var(--shadow-pop-sm)] active:translate-y-0.5 active:shadow-none"
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </li>
          ),
        )}
        {items.length === 0 && !adding && (
          <li className="rounded-3xl border-2 border-dashed border-ink/30 p-8 text-center text-ink-soft">Nothing yet. Add the first thing you sell.</li>
        )}
      </ul>

      <div className="mt-5">
        {adding ? (
          <ItemForm
            title="Add an item"
            suggestions={suggestions}
            submitLabel="Add (sold 1)"
            onCancel={() => setAdding(false)}
            onSubmit={(v) => {
              const id = crypto.randomUUID();
              change(id, { id, ...v, qty: 1 });
              setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="btn btn-primary w-full" onClick={() => setAdding(true)}>
            + Add an item
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className={`font-display font-extrabold tabular-nums ${strong ? "text-2xl" : "text-xl"}`}>{value}</dd>
    </div>
  );
}

function ItemForm({
  title,
  initial,
  suggestions,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  title: string;
  initial?: BoothItem;
  suggestions: BoothSuggestion[];
  submitLabel: string;
  onSubmit: (v: { name: string; price: number; cost: number }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [cost, setCost] = useState(initial ? String(initial.cost) : "");
  const [error, setError] = useState<string | null>(null);
  const listId = "booth-suggestions";

  // Picking something she has sold (or a shop product) fills in its price and cost.
  function onName(v: string) {
    setName(v);
    const hit = suggestions.find((s) => s.name.toLowerCase() === v.trim().toLowerCase());
    if (hit) {
      setPrice(String(hit.price));
      if (hit.cost !== undefined) setCost(String(hit.cost));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(price);
    const c = Number(cost);
    if (!name.trim()) return setError("What is it called?");
    if (price.trim() === "" || !Number.isFinite(p) || p < 0) return setError("How much are you selling it for?");
    if (cost.trim() === "" || !Number.isFinite(c) || c < 0) return setError("About how much does it cost to make? Enter 0 if you're not sure.");
    setError(null);
    onSubmit({ name: name.trim(), price: Math.round(p * 100) / 100, cost: Math.round(c * 100) / 100 });
  }

  return (
    <form onSubmit={submit} method="post" className="chunky space-y-4 rounded-3xl bg-paper p-4">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      <label className="block">
        <span className="admin-label">What is it?</span>
        <input className="admin-input" value={name} maxLength={120} list={listId} autoComplete="off" placeholder="e.g. Bloop the Robot" onChange={(e) => onName(e.target.value)} />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s.name} value={s.name} />
          ))}
        </datalist>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Money label="Selling it for" value={price} onChange={setPrice} />
        <Money label="Costs to make" value={cost} onChange={setCost} />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-tomato-soft px-3 py-2 text-sm font-semibold">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="ml-auto text-sm font-semibold text-tomato underline decoration-2 underline-offset-4" onClick={onDelete}>
            Remove item
          </button>
        )}
      </div>
    </form>
  );
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="admin-label">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">$</span>
        <input className="admin-input pl-7" inputMode="decimal" placeholder="0.00" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}
