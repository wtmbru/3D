import { site } from "@/config/site";
import { formatPrice } from "./pricing";
import { orderLabel, type Order } from "./orders";

export type TextKind = "payment" | "printing" | "ready" | "thanks";

export const TEXT_KINDS: { id: TextKind; label: string }[] = [
  { id: "payment", label: "Payment" },
  { id: "printing", label: "Printing" },
  { id: "ready", label: "Ready" },
  { id: "thanks", label: "Thanks" },
];

/** The message that fits where the order is right now. */
export function defaultTextKind(o: Pick<Order, "status" | "paymentStatus">): TextKind {
  if (o.status === "completed") return "thanks";
  if (o.status === "ready") return "ready";
  if (o.status === "printing") return "printing";
  return o.paymentStatus === "unpaid" ? "payment" : "printing";
}

/** Ready-to-send texts for an order. She can edit them before sending. */
export function orderText(
  kind: TextKind,
  o: Pick<Order, "name" | "number" | "total" | "delivery">,
  extra: { trackingUrl: string; methodLabel: string; handle?: string },
): string {
  const first = o.name.trim().split(/\s+/)[0] || "there";
  const num = orderLabel(o.number);
  const link = extra.trackingUrl ? `\nFollow your order here: ${extra.trackingUrl}` : "";
  switch (kind) {
    case "payment":
      return `Hi ${first}! It's ${site.name}. Thanks for your order ${num}. To get it started, please send ${formatPrice(o.total)} with ${extra.methodLabel}${
        extra.handle ? ` to ${extra.handle}` : ""
      } and put ${num} in the note.${link}`;
    case "printing":
      return `Hi ${first}! Good news: your order ${num} is printing now.${link}`;
    case "ready":
      return o.delivery === "shipping"
        ? `Hi ${first}! Your order ${num} is ready 🎉 I'll get it shipped out soon.${link}`
        : `Hi ${first}! Your order ${num} is ready 🎉 Let me know when you'd like to pick it up.${link}`;
    case "thanks":
      return `Thanks so much, ${first}! We hope you love your order ${num}. If you do, a photo or a share means a lot to a small shop. 💛`;
  }
}
