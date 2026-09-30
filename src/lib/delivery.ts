import { z } from "zod";

/*
 * How an order gets to the customer: local pickup, or shipping to an address.
 * Pure, so the storefront, the server and the admin panel can all use it.
 */

export type DeliveryMethod = "pickup" | "shipping";
export const DELIVERY_METHODS: { id: DeliveryMethod; label: string }[] = [
  { id: "pickup", label: "Local pickup" },
  { id: "shipping", label: "Ship to me" },
];
export const deliveryLabel = (m: DeliveryMethod) => DELIVERY_METHODS.find((d) => d.id === m)?.label ?? m;

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

/** The address the customer typed, checked. US addresses: the shop accepts Zelle, Venmo and Cash App. */
export const shippingAddressSchema = z.object({
  line1: z.string().trim().min(1, "Please enter your street address.").max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1, "Please enter your city.").max(80),
  state: z.string().trim().min(2, "Please enter your state.").max(40),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Please enter a 5-digit ZIP code."),
});

export interface DeliverySettings {
  /** Flat fee added to shipped orders. 0 means free shipping. */
  shippingFee: number;
  /** Shown to customers choosing pickup, e.g. where and when. */
  pickupNote: string;
}
export const DEFAULT_DELIVERY: DeliverySettings = { shippingFee: 0, pickupNote: "" };

/** Fills in anything missing or nonsensical from stored settings. */
export function normalizeDelivery(raw: unknown): DeliverySettings {
  const r = (raw ?? {}) as Partial<DeliverySettings>;
  const fee = typeof r.shippingFee === "number" && Number.isFinite(r.shippingFee) && r.shippingFee >= 0 && r.shippingFee <= 1000 ? r.shippingFee : 0;
  return { shippingFee: Math.round(fee * 100) / 100, pickupNote: typeof r.pickupNote === "string" ? r.pickupNote.slice(0, 300) : "" };
}

/** "123 Main St", "Apt 4", "Austin, TX 78701" */
export function addressLines(a: ShippingAddress): string[] {
  return [a.line1, ...(a.line2 ? [a.line2] : []), `${a.city}, ${a.state.toUpperCase()} ${a.zip}`];
}
export const addressText = (a: ShippingAddress) => addressLines(a).join("\n");

/** What a shipped order costs on top of the goods. Pickup is always free. */
export const shippingFeeFor = (method: DeliveryMethod, s: DeliverySettings) => (method === "shipping" ? s.shippingFee : 0);
