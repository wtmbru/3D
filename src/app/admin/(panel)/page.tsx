import Link from "next/link";
import { getCatalog, getProducts } from "@/lib/server/catalog";

export default async function Dashboard() {
  const [{ filaments }, products] = await Promise.all([getCatalog(), getProducts(true)]);
  const published = products.filter((p) => p.published).length;
  const drafts = products.length - published;
  const outOfStock = filaments.filter((f) => !f.inStock);

  const stats = [
    { label: "Live products", value: published, href: "/admin/products", tone: "bg-mint-soft" },
    { label: "Drafts", value: drafts, href: "/admin/products", tone: "bg-sun-soft" },
    { label: "Filaments in stock", value: filaments.length - outOfStock.length, href: "/admin/filaments", tone: "bg-sky-soft" },
    { label: "Out of stock", value: outOfStock.length, href: "/admin/filaments", tone: "bg-tomato-soft" },
  ];

  return (
    <div>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Hi there 👋</h1>
      <p className="mt-2 text-ink-soft">Here&apos;s what&apos;s on the shelf.</p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`chunky focus-ring rounded-3xl p-5 transition-transform hover:-translate-y-0.5 ${s.tone}`}>
            <p className="font-display text-4xl font-extrabold tabular-nums">{s.value}</p>
            <p className="mt-1 text-sm font-semibold text-ink-soft">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="admin-card">
          <h2 className="admin-h2">Add a new design</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Export one STL per color from Bambu Studio, upload them, pick default colors and set a price.
          </p>
          <Link href="/admin/products/new" className="btn btn-primary btn-sm mt-4">
            + New product
          </Link>
        </div>
        <div className="admin-card">
          <h2 className="admin-h2">Spool ran out?</h2>
          {outOfStock.length ? (
            <p className="mt-2 text-sm text-ink-soft">
              Currently out: {outOfStock.map((f) => f.name).join(", ")}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Everything is in stock right now.</p>
          )}
          <Link href="/admin/filaments" className="btn btn-secondary btn-sm mt-4">
            Manage filaments
          </Link>
        </div>
      </div>
    </div>
  );
}
