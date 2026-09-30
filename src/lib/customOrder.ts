import { linkHost, requestLabel, type CustomRequest } from "./requests";
import type { NewOrder } from "./server/orders";
import type { PaymentMethod } from "./orders";

/**
 * An accepted custom request, as an order: one line for the custom print at the quoted
 * price, with the colors the customer picked. The model link and message travel in the
 * order's note so she has everything on the order page.
 */
export function orderFromRequest(r: CustomRequest, payment: PaymentMethod): NewOrder {
  const price = r.quotePrice ?? 0;
  const head = `From custom request ${requestLabel(r.number)}\nModel (${linkHost(r.modelUrl)}): ${r.modelUrl}\n\n`;
  return {
    name: r.name,
    email: r.email,
    phone: r.phone,
    payment,
    notes: `${head}${r.message}`.slice(0, 1000),
    items: [
      {
        id: crypto.randomUUID(),
        productId: "custom",
        slug: "custom",
        name: `Custom print ${requestLabel(r.number)}`,
        family: r.colors[0]?.family ?? "PLA",
        qty: r.quantity,
        unitPrice: price,
        config: {},
        parts: r.colors.map((c, i) => ({
          id: c.id,
          name: `Color ${i + 1}`,
          filamentId: c.id,
          filamentName: c.name,
          finish: c.finish,
          hex: c.hex,
          ...(c.hex2 ? { hex2: c.hex2 } : {}),
        })),
        addons: [],
        status: "queued",
      },
    ],
    total: Math.round(price * r.quantity * 100) / 100,
  };
}
