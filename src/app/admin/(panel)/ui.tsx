"use client";

import { useEffect, useState } from "react";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`focus-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-ink transition-colors disabled:opacity-50 ${
        checked ? "bg-mint" : "bg-cream-deep"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full border-2 border-ink bg-paper transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

/** Inline success/error message that fades after a moment. */
export function useNotice() {
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  useEffect(() => {
    if (notice?.kind !== "ok") return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
}

export function Notice({ notice }: { notice: { kind: "ok" | "error"; text: string } | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.kind === "error" ? "alert" : "status"}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.kind === "error" ? "bg-tomato-soft" : "bg-mint-soft"}`}
    >
      {notice.text}
    </p>
  );
}
