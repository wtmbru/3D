import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requests";

export function RequestBadge({ status }: { status: RequestStatus }) {
  const s = REQUEST_STATUSES.find((x) => x.id === status)!;
  return <span className={`chip px-2.5 py-0.5 text-xs ${s.tone}`}>{s.label}</span>;
}
