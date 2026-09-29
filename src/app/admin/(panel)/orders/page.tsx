import type { Metadata } from "next";
import { listOrders } from "@/lib/server/orders";
import { OrdersList } from "./OrdersList";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  let orders;
  try {
    orders = await listOrders();
  } catch (e) {
    return (
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Orders</h1>
        <p role="alert" className="mt-6 rounded-2xl bg-sun-soft px-4 py-3 font-semibold">
          {e instanceof Error ? e.message : "Couldn't load orders."}
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Orders</h1>
      <p className="mt-2 text-ink-soft">Every order that comes in from the store lands here.</p>
      <OrdersList orders={orders} />
    </div>
  );
}
