import type { Metadata } from "next";
import { CatalogProvider } from "@/components/CatalogProvider";
import { requireAdminPage } from "@/lib/server/auth";
import { getCatalog } from "@/lib/server/catalog";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const catalog = await getCatalog();
  const connected = isSupabaseConfigured();

  return (
    <CatalogProvider catalog={catalog}>
      <AdminNav />
      {!connected && (
        <div className="border-b-2 border-ink bg-sun px-4 py-3 text-center text-sm font-semibold">
          Supabase isn&apos;t connected, so you&apos;re looking at the sample catalog and nothing can be
          saved yet. See <code>README.md</code> → &quot;Connect Supabase&quot;.
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </CatalogProvider>
  );
}
