import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/orders";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUSES.find((x) => x.id === status)!;
  return <span className={`chip px-2.5 py-0.5 text-xs ${s.tone}`}>{s.label}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUSES.find((x) => x.id === status)!;
  return <span className={`chip px-2.5 py-0.5 text-xs ${s.tone}`}>{s.label}</span>;
}

/** Local, human date. Rendered on the client's clock, so hydration may differ by timezone. */
export function When({ iso, className }: { iso: string; className?: string }) {
  const text = new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <time dateTime={iso} suppressHydrationWarning className={className}>
      {text}
    </time>
  );
}
