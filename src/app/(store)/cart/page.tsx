import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { getProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const products = await getProducts();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Your cart</h1>
      <CartView products={products} />
    </div>
  );
}
