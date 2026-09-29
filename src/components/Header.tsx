"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartCount } from "@/lib/cart";
import { Logo } from "./Logo";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/colors", label: "Colors" },
  { href: "/custom", label: "Custom print" },
  { href: "/#how-it-works", label: "How it works" },
];

export function Header() {
  const pathname = usePathname();
  const count = useCartCount();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-cream/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="focus-ring rounded-lg" aria-label="Home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => {
            const active = l.href !== "/#how-it-works" && pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`focus-ring hidden rounded-full px-3 py-1.5 font-display text-[15px] font-bold transition-colors sm:block ${
                  active ? "bg-ink text-cream" : "hover:bg-cream-deep"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/shop"
            className="focus-ring rounded-full px-3 py-1.5 font-display text-[15px] font-bold sm:hidden"
          >
            Shop
          </Link>
          <Link href="/cart" className="btn btn-sun btn-sm ml-1" aria-label={`Cart, ${count} items`}>
            <CartIcon />
            <span className="tabular-nums">{count}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 7h14l-1.5 10.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
