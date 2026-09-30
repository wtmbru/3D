import { z } from "zod";

/*
 * Booth (local) sales: a "booth day" holds the items sold that day. Pure, so the admin pages
 * and the server share the same totals and checks.
 */

export interface BoothItem {
  id: string;
  name: string;
  /** What one sold for. */
  price: number;
  /** What one cost to make. */
  cost: number;
  /** How many sold. */
  qty: number;
}

export interface BoothSession {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  day: string;
  createdAt: string;
}

export interface BoothTotals {
  sales: number;
  cost: number;
  profit: number;
  units: number;
}

const cents = (n: number) => Math.round(n * 100);

/** Adds up in whole cents so the totals never drift by a fraction of a cent. */
export function boothTotals(items: Pick<BoothItem, "price" | "cost" | "qty">[]): BoothTotals {
  let sales = 0;
  let cost = 0;
  let units = 0;
  for (const i of items) {
    sales += cents(i.price) * i.qty;
    cost += cents(i.cost) * i.qty;
    units += i.qty;
  }
  return { sales: sales / 100, cost: cost / 100, profit: (sales - cost) / 100, units };
}

export const EMPTY_TOTALS: BoothTotals = { sales: 0, cost: 0, profit: 0, units: 0 };

export const sumTotals = (list: BoothTotals[]): BoothTotals =>
  list.reduce((a, t) => ({ sales: a.sales + t.sales, cost: a.cost + t.cost, profit: a.profit + t.profit, units: a.units + t.units }), EMPTY_TOTALS);

const money = (label: string) =>
  z
    .number(`Please enter ${label}.`)
    .finite(`Please enter ${label}.`)
    .min(0, `${label[0].toUpperCase()}${label.slice(1)} can't be negative.`)
    .max(100_000, `That ${label} looks too high.`)
    .transform((n) => Math.round(n * 100) / 100);

export const boothItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Please enter the item's name.").max(120, "That name is too long."),
  price: money("the price it sells for"),
  cost: money("what it costs to make"),
  qty: z.number().int("Quantity must be a whole number.").min(0).max(100_000),
});

export const boothSessionSchema = z.object({
  name: z.string().trim().min(1, "Please name this booth day.").max(120, "That name is too long."),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date."),
});

/** Today as YYYY-MM-DD in the viewer's own time zone. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
