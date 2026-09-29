import type { ColorConfig, Finish, MaterialFamily } from "./types";

/*
 * Order types and rules shared by the storefront and the admin panel. Pure
 * (no server or client imports) so both sides can use it.
 */

export const PAYMENT_METHODS = [
  { id: "zelle", label: "Zelle" },
  { id: "venmo", label: "Venmo" },
  { id: "cashapp", label: "Cash App" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
export const paymentLabel = (id: PaymentMethod) => PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;

export type PaymentStatus = "unpaid" | "paid" | "refunded";
export const PAYMENT_STATUSES: { id: PaymentStatus; label: string; tone: string }[] = [
  { id: "unpaid", label: "Unpaid", tone: "bg-tomato-soft" },
  { id: "paid", label: "Paid", tone: "bg-mint-soft" },
  { id: "refunded", label: "Refunded", tone: "bg-cream-deep" },
];

export type OrderStatus = "new" | "printing" | "ready" | "completed" | "cancelled";
export const ORDER_STATUSES: { id: OrderStatus; label: string; tone: string; hint: string }[] = [
  { id: "new", label: "New", tone: "bg-sun", hint: "Just came in" },
  { id: "printing", label: "Printing", tone: "bg-sky-soft", hint: "Being printed" },
  { id: "ready", label: "Ready", tone: "bg-grape-soft", hint: "Ready for pickup or delivery" },
  { id: "completed", label: "Completed", tone: "bg-mint-soft", hint: "Handed over" },
  { id: "cancelled", label: "Cancelled", tone: "bg-cream-deep", hint: "Won't be made" },
];
/** The normal path an order follows (cancelled is separate). */
export const PIPELINE: OrderStatus[] = ["new", "printing", "ready", "completed"];

export type ItemStatus = "queued" | "printing" | "done";
export const ITEM_STATUSES: { id: ItemStatus; label: string }[] = [
  { id: "queued", label: "Queued" },
  { id: "printing", label: "Printing" },
  { id: "done", label: "Done" },
];

export interface OrderItemPart {
  id: string;
  name: string;
  /** Print job (plate) number, when the product has several. */
  plate?: number;
  filamentId: string;
  filamentName: string;
  finish: Finish;
  hex: string;
  hex2?: string;
}

/** One line of an order, frozen at order time. */
export interface OrderItem {
  id: string;
  productId: string;
  slug: string;
  name: string;
  /** Selected size/shape, when the product has options. */
  variantId?: string;
  variantName?: string;
  family: MaterialFamily;
  qty: number;
  unitPrice: number;
  /** partId → filamentId, for re-rendering a picture of the design. */
  config: ColorConfig;
  parts: OrderItemPart[];
  /** e.g. "Attachment: Keyring" */
  addons: string[];
  status: ItemStatus;
}

export interface Order {
  id: string;
  /** Friendly number shown to people: 1001, 1002… */
  number: number;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  payment: PaymentMethod;
  notes?: string;
  items: OrderItem[];
  total: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  adminNotes?: string;
  paidAt?: string;
  completedAt?: string;
}

export const orderLabel = (n: number) => `#${n}`;
export const isOpen = (o: Pick<Order, "status">) => o.status !== "completed" && o.status !== "cancelled";
export const itemCount = (o: Pick<Order, "items">) => o.items.reduce((n, i) => n + i.qty, 0);

/**
 * Order status after an item's print progress changes: starting a print moves
 * a new order to Printing, and finishing every item moves it to Ready. It
 * never overrides Ready/Completed/Cancelled that she set herself.
 */
export function statusAfterItemChange(current: OrderStatus, items: Pick<OrderItem, "status">[]): OrderStatus {
  if (current !== "new" && current !== "printing") return current;
  if (items.length && items.every((i) => i.status === "done")) return "ready";
  if (items.some((i) => i.status !== "queued")) return "printing";
  return current;
}

export interface ProgressStep {
  key: string;
  label: string;
  done: boolean;
}

/** The customer-facing timeline. */
export function progressSteps(o: Pick<Order, "paymentStatus" | "status">): ProgressStep[] {
  const at = (s: OrderStatus) => PIPELINE.indexOf(o.status) >= PIPELINE.indexOf(s);
  return [
    { key: "placed", label: "Order placed", done: true },
    { key: "paid", label: "Payment received", done: o.paymentStatus === "paid" },
    { key: "printing", label: "Printing", done: at("printing") },
    { key: "ready", label: "Ready for you", done: at("ready") },
    { key: "completed", label: "Complete", done: at("completed") },
  ];
}

export interface PaymentSettings {
  zelle: string;
  venmo: string;
  cashapp: string;
  /** Extra instructions shown with the payment details. */
  note: string;
}
export const EMPTY_PAYMENT_SETTINGS: PaymentSettings = { zelle: "", venmo: "", cashapp: "", note: "" };
