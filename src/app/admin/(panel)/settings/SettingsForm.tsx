"use client";

import { useState, useTransition } from "react";
import type { PaymentSettings } from "@/lib/orders";
import { savePayments } from "../../order-actions";
import { Notice, useNotice } from "../ui";

const FIELDS: { key: "zelle" | "venmo" | "cashapp"; label: string; placeholder: string; hint: string }[] = [
  { key: "zelle", label: "Zelle", placeholder: "name@email.com or (555) 123-4567", hint: "The email or phone number your Zelle is linked to." },
  { key: "venmo", label: "Venmo", placeholder: "@username", hint: "Your Venmo username." },
  { key: "cashapp", label: "Cash App", placeholder: "$cashtag", hint: "Your $cashtag." },
];

export function SettingsForm({ initial }: { initial: PaymentSettings }) {
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
          const res = await savePayments(s);
          if (res.ok) {
            setSaved(s);
            setNotice({ kind: "ok", text: "Saved." });
          } else setNotice({ kind: "error", text: res.error });
        });
      }}
    >
      <h2 className="admin-h2">Payment details</h2>
      {FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="admin-label">{f.label}</span>
          <input className="admin-input" value={s[f.key]} maxLength={80} placeholder={f.placeholder} onChange={(e) => setS({ ...s, [f.key]: e.target.value })} />
          <span className="admin-hint">{f.hint}</span>
        </label>
      ))}
      <label className="block">
        <span className="admin-label">Extra instructions (optional)</span>
        <textarea
          className="admin-input min-h-20"
          maxLength={300}
          value={s.note}
          placeholder="e.g. Printing starts once payment arrives."
          onChange={(e) => setS({ ...s, note: e.target.value })}
        />
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
