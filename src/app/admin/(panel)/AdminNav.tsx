"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { logout } from "../actions";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/filaments", label: "Filaments" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ newOrders = 0 }: { newOrders?: number }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/admin" className="focus-ring flex items-center gap-2 rounded-lg">
          <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          <span className="chip bg-grape px-2 py-0.5 text-xs text-paper">Admin</span>
        </Link>
        <nav className="ml-2 flex flex-1 items-center gap-1 overflow-x-auto">
          {links.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`focus-ring rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap transition-colors ${
                  active ? "bg-ink text-cream" : "hover:bg-cream-deep"
                }`}
              >
                {l.label}
                {l.href === "/admin/orders" && newOrders > 0 && (
                  <span
                    className="ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-tomato px-1.5 text-xs font-extrabold text-paper"
                    aria-label={`${newOrders} new`}
                  >
                    {newOrders}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <Link href="/" target="_blank" className="hidden text-sm font-semibold text-ink-soft hover:text-ink sm:block">
          View store ↗
        </Link>
        <form action={logout}>
          <button type="submit" className="btn btn-secondary btn-sm">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
