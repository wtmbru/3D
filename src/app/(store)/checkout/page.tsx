import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const products = await getProducts();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Almost there</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Place your order</h1>
      <CheckoutForm products={products} />
    </div>
  );
}
