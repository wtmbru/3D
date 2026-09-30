import Link from "next/link";
import { site } from "@/config/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t-2 border-ink bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-cream/70">{site.description}</p>
        </div>
        <div>
          <h2 className="font-display font-bold text-sun">Shop</h2>
          <ul className="mt-3 space-y-2 text-cream/80">
            <li><Link className="hover:text-cream" href="/shop">All products</Link></li>
            <li><Link className="hover:text-cream" href="/colors">Filament colors</Link></li>
            <li><Link className="hover:text-cream" href="/custom">Custom print request</Link></li>
            <li><Link className="hover:text-cream" href="/track">Track your order</Link></li>
            <li><Link className="hover:text-cream" href="/cart">Cart</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-display font-bold text-sun">Good to know</h2>
          <ul className="mt-3 space-y-2 text-cream/80">
            <li>Every order is printed just for you</li>
            <li>Custom items can&apos;t be returned</li>
            <li>Screen colors may vary slightly from real filament</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/15 py-5 text-center text-sm text-cream/50">
        © {new Date().getFullYear()} {site.name}. Made layer by layer.
      </div>
    </footer>
  );
}
