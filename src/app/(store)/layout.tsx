import { connection } from "next/server";
import { CartHydrator } from "@/components/CartHydrator";
import { CatalogProvider } from "@/components/CatalogProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getCatalog } from "@/lib/server/catalog";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Render store pages per visitor, not at build time. The catalog lives in Supabase, and a
  // deployment shouldn't succeed or fail depending on the database's health at build time
  // (a stale build would also show old products). A brief database hiccup now only affects
  // the one request it lands on, and the next one works.
  await connection();
  const catalog = await getCatalog();
  return (
    <CatalogProvider catalog={catalog}>
      <CartHydrator />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </CatalogProvider>
  );
}
