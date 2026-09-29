import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { orderLabel, paymentLabel, type PaymentMethod } from "@/lib/orders";
import { getProducts } from "@/lib/server/catalog";
import { getOrderById, getPaymentSettings } from "@/lib/server/orders";
import type { Product } from "@/lib/types";
import { resolveVariant, variantsOf } from "@/lib/variants";
import { OrderDetail } from "./OrderDetail";

export async function generateMetadata(props: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const order = await getOrderById((await props.params).id);
  return { title: order ? `Order ${orderLabel(order.number)}` : "Order" };
}

export default async function OrderPage(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const [order, products, payments] = await Promise.all([getOrderById(id), getProducts(true), getPaymentSettings()]);
  if (!order) notFound();

  // A small picture of each design, if its product still exists.
  const thumbs: Record<string, Product> = {};
  for (const item of order.items) {
    const full = products.find((p) => p.id === item.productId);
    if (!full) continue;
    const variant = variantsOf(full).find((v) => v.id === item.variantId);
    thumbs[item.id] = resolveVariant(full, variant?.id);
  }

  return <OrderDetail order={order} thumbs={thumbs} handle={payments[order.payment as PaymentMethod]} methodLabel={paymentLabel(order.payment)} />;
}
