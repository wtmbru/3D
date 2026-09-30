/*
 * Finding your own order or request without a login: the email plus your phone
 * number and/or name, all of which must match what was entered when you ordered.
 */

const digits = (s: string) => s.replace(/\D/g, "");
/** Compare phones by their last 10 digits so "+1 (555) 123-4567" equals "5551234567". */
const phoneKey = (s: string) => digits(s).slice(-10);
const nameKey = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function contactMatches(record: { name: string; phone: string }, given: { phone?: string; name?: string }): boolean {
  const hasPhone = !!given.phone && digits(given.phone).length >= 7;
  const hasName = !!given.name?.trim();
  if (!hasPhone && !hasName) return false; // an email alone is never enough
  if (hasPhone && phoneKey(record.phone) !== phoneKey(given.phone!)) return false;
  if (hasName && nameKey(record.name) !== nameKey(given.name!)) return false;
  return true;
}

/** Escape LIKE wildcards so an email is matched literally (case-insensitively). */
export const likeLiteral = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export interface TrackResult {
  kind: "order" | "request";
  id: string;
  label: string;
  createdAt: string;
  /** Plain-words status, e.g. "Printing" or "Quote ready". */
  status: string;
  total?: number;
}
