"use client";

import { useState, useTransition } from "react";
import type { CostSettings } from "@/lib/costs";
import { FAMILIES } from "@/data/constants";
import { saveCosts } from "../../cost-actions";
import { Notice, useNotice } from "../ui";

/** Private assumptions behind the weight and cost estimates in the product editor. */
export function CostSettingsCard({ initial }: { initial: CostSettings }) {
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
          const res = await saveCosts(s);
          if (res.ok) {
            setSaved(s);
            setNotice({ kind: "ok", text: "Saved." });
          } else setNotice({ kind: "error", text: res.error });
        });
      }}
    >
      <div>
        <h2 className="admin-h2">Cost estimates (private)</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Used for the weight and cost estimate in each product. Customers never see this.
        </p>
      </div>
      <fieldset>
        <legend className="admin-label">What you pay for a kilo of filament</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {FAMILIES.map((fam) => (
            <label key={fam} className="block">
              <span className="text-sm font-semibold">{fam}</span>
              <div className="relative w-32">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">$</span>
                <input
                  className="admin-input pl-7"
                  type="number"
                  min={0}
                  step={0.5}
                  value={s.perKg[fam]}
                  onChange={(e) => setS({ ...s, perKg: { ...s.perKg, [fam]: Number(e.target.value) } })}
                />
              </div>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-6">
        <label className="block">
          <span className="admin-label">How solid your prints are (%)</span>
          <input className="admin-input w-32" type="number" min={1} max={100} value={s.solidPct} onChange={(e) => setS({ ...s, solidPct: Number(e.target.value) })} />
          <span className="admin-hint">The share of the model that&apos;s plastic. About 30–45 suits typical Bambu settings.</span>
        </label>
        <label className="block">
          <span className="admin-label">Waste allowance (%)</span>
          <input className="admin-input w-32" type="number" min={0} max={100} value={s.wastePct} onChange={(e) => setS({ ...s, wastePct: Number(e.target.value) })} />
          <span className="admin-hint">Extra for supports, color changes and failed starts.</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <Notice notice={notice} />
      </div>
    </form>
  );
}
