import { CartHydrator } from "@/components/CartHydrator";
import { CatalogProvider } from "@/components/CatalogProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getCatalog } from "@/lib/server/catalog";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
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
