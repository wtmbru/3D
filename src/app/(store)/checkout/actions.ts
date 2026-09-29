"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { FAMILIES } from "@/data/constants";
import { MAX_QTY } from "@/lib/pricing";
import { clientIp } from "@/lib/server/auth";
import { getCatalog, getProducts } from "@/lib/server/catalog";
import { notifyNewOrder } from "@/lib/server/notify";
import { buildOrderItems, countRecentOrders, insertOrder } from "@/lib/server/orders";

// Orders are public (no login), so the basics against abuse live here.
const MAX_ORDERS_PER_HOUR = 5;

const cartItemSchema = z.object({
  slug: z.string().max(100),
  variant: z.string().max(60).optional(),
  family: z.enum(FAMILIES),
  config: z.record(z.string().max(60), z.string().max(80)),
  addons: z.record(z.string().max(60), z.string().max(60)).optional(),
  qty: z.number().int().min(1, "Please check the quantities in your cart.").max(MAX_QTY, `You can order up to ${MAX_QTY} of each design at a time.`),
});

const orderSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(80),
  email: z.string().trim().email("Please enter a valid email address.").max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    }, "Please enter a valid phone number."),
  payment: z.enum(["zelle", "venmo", "cashapp"], { message: "Please choose how you'll pay." }),
  notes: z.string().trim().max(500).optional(),
  /** Honeypot: hidden from people, so only bots fill it in. */
  website: z.string().max(200).optional(),
  items: z.array(cartItemSchema).min(1, "Your cart is empty.").max(20, "That's a lot of items! Please split it into two orders."),
});

export type PlaceOrderInput = z.input<typeof orderSchema>;
export type PlaceOrderResult = { ok: true; id: string } | { ok: false; error: string };

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const data = parsed.data;
  if (data.website) return { ok: false, error: "Something went wrong. Please try again." };

  try {
    const ipHash = createHash("sha256")
      .update(`${await clientIp()}|${process.env.ADMIN_SESSION_SECRET ?? ""}`)
      .digest("hex");
    if ((await countRecentOrders(ipHash, 60 * 60 * 1000)) >= MAX_ORDERS_PER_HOUR) {
      return { ok: false, error: "You've placed several orders recently. Please wait a bit, or contact us directly." };
    }

    // Price and validate against the real catalog. Nothing the browser sent about prices is trusted.
    const [catalog, products] = await Promise.all([getCatalog(), getProducts()]);
    const built = buildOrderItems(catalog, products, data.items);
    if (!built.ok) return built;

    const order = await insertOrder({
      name: data.name,
      email: data.email,
      phone: data.phone,
      payment: data.payment,
      notes: data.notes,
      items: built.items,
      total: built.total,
      ipHash,
    });
    // Tell her after the customer has their confirmation, so a slow email service never delays them.
    after(() => notifyNewOrder(order));
    return { ok: true, id: order.id };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "We couldn't place your order just now. Please try again in a moment." };
  }
}
