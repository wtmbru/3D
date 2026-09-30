"use client";

import { useState, useTransition } from "react";
import type { DeliverySettings } from "@/lib/delivery";
import { saveDelivery } from "../../delivery-actions";
import { Notice, useNotice } from "../ui";

/** Shipping fee and pickup instructions customers see at checkout. */
export function DeliveryCard({ initial }: { initial: DeliverySettings }) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useNotice();
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  return (
    <form
      method="post"
      className="admin-card mt-8 max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveDelivery(s);
          if (res.ok) {
            setSaved(s);
            setNotice({ kind: "ok", text: "Saved." });
          } else setNotice({ kind: "error", text: res.error });
        });
      }}
    >
      <div>
        <h2 className="admin-h2">Pickup & shipping</h2>
        <p className="mt-1 text-sm text-ink-soft">Customers choose one at checkout. Shipping needs their address.</p>
      </div>
      <label className="block">
        <span className="admin-label">Shipping fee</span>
        <div className="relative w-36">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">$</span>
          <input
            className="admin-input pl-7"
            type="number"
            min={0}
            step={0.5}
            value={s.shippingFee}
            onChange={(e) => setS({ ...s, shippingFee: Number(e.target.value) })}
          />
        </div>
        <span className="admin-hint">A flat fee added to every shipped order. 0 means free shipping. Pickup is always free.</span>
      </label>
      <label className="block">
        <span className="admin-label">Pickup instructions (optional)</span>
        <textarea
          className="admin-input min-h-20"
          maxLength={300}
          value={s.pickupNote}
          placeholder="e.g. Pickup in Austin, TX. We'll message you a time and place."
          onChange={(e) => setS({ ...s, pickupNote: e.target.value })}
        />
        <span className="admin-hint">Shown to customers who choose pickup, at checkout and on their order page.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <Notice notice={notice} />
      </div>
    </form>
  );
}
