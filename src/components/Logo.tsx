import { site } from "@/config/site";

/** Three stacked "print layers" + wordmark. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" className="shrink-0">
        <rect x="3" y="22" width="28" height="9" rx="4.5" fill="var(--color-mint)" stroke="var(--color-ink)" strokeWidth="2" />
        <rect x="6" y="12.5" width="22" height="9" rx="4.5" fill="var(--color-sun)" stroke="var(--color-ink)" strokeWidth="2" />
        <rect x="9" y="3" width="16" height="9" rx="4.5" fill="var(--color-tomato)" stroke="var(--color-ink)" strokeWidth="2" />
      </svg>
      <span className="font-display text-xl font-extrabold tracking-tight">{site.name}</span>
    </span>
  );
}
