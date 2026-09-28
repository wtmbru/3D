import Link from "next/link";
import { HeroViewer } from "@/components/home/HeroViewer";
import { ProductCard } from "@/components/ProductCard";
import { SwatchDot } from "@/components/Swatch";
import { categories } from "@/data/constants";
import { getCatalog, getProducts } from "@/lib/server/catalog";

const steps = [
  {
    n: "1",
    title: "Pick a design",
    body: "Browse figures, planters, desk buddies and charms, all designed to print in multiple colors.",
    color: "bg-sun",
  },
  {
    n: "2",
    title: "Paint every part",
    body: "Tap any part of the 3D model and choose from real filament we have on the shelf. What you see is what gets printed.",
    color: "bg-mint",
  },
  {
    n: "3",
    title: "We print it for you",
    body: "Your piece is printed in one go, up to 4 colors, then checked by hand and shipped in a few days.",
    color: "bg-bubble",
  },
];

export default async function Home() {
  const [{ filaments }, products] = await Promise.all([getCatalog(), getProducts()]);
  const featured = products.filter((p) => p.featured);
  // Hero: the first featured product with color presets to cycle through.
  const hero = featured.find((p) => p.presets.length > 1) ?? featured[0] ?? products[0];
  const inStock = filaments.filter((f) => f.inStock);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div>
            <span className="chip bg-mint-soft">
              <span className="h-2 w-2 rounded-full bg-mint" /> Printed to order, in small batches
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Pick it. <span className="text-tomato">Paint it.</span>{" "}
              <span className="relative inline-block">
                We print it.
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 8 C 60 2, 120 12, 180 6 S 280 4, 298 7" stroke="var(--color-sun)" strokeWidth="6" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink-soft">
              Playful 3D-printed goods you design yourself. Spin the model, tap a part and pick from
              real filament colors. Every piece is made just for you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn btn-primary">
                Start customizing →
              </Link>
              <Link href="/colors" className="btn btn-secondary">
                See our colors
              </Link>
            </div>
          </div>
          {hero && (
            <div className="mx-auto w-full max-w-md md:max-w-none">
              <HeroViewer product={hero} />
            </div>
          )}
        </div>
      </section>

      {/* Filament marquee */}
      <section aria-label="Filament colors" className="overflow-hidden border-y-2 border-ink bg-paper py-4">
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
          {[...inStock, ...inStock].map((f, i) => (
            <span key={`${f.id}-${i}`} className="chip shrink-0 bg-cream" aria-hidden={i >= inStock.length}>
              <SwatchDot filament={f} size={16} />
              {f.name}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Three steps to your one-of-a-kind thing</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.n} className={`chunky rounded-[var(--radius-blob)] bg-paper p-6 ${i === 1 ? "md:translate-y-4" : ""}`}>
              <span className={`chunky grid h-12 w-12 place-items-center rounded-2xl font-display text-2xl font-extrabold ${s.color}`}>
                {s.n}
              </span>
              <h3 className="mt-5 font-display text-xl font-extrabold">{s.title}</h3>
              <p className="mt-2 text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Fresh off the build plate</p>
            <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Customer favorites</h2>
          </div>
          <Link href="/shop" className="btn btn-secondary btn-sm hidden sm:inline-flex">
            View all
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-4xl font-extrabold tracking-tight">Shop by vibe</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {categories.map((c, i) => (
            <Link
              key={c.id}
              href={`/shop?category=${c.id}`}
              className={`chunky focus-ring group flex items-center justify-between rounded-[var(--radius-blob)] p-5 font-display text-lg font-extrabold transition-transform hover:-translate-y-1 ${
                ["bg-sun-soft", "bg-sky-soft", "bg-mint-soft", "bg-bubble-soft"][i]
              }`}
            >
              {c.label}
              <span className="text-2xl transition-transform group-hover:animate-wiggle" aria-hidden="true">
                {c.emoji}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Colors CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="chunky layer-lines relative overflow-hidden rounded-[40px] bg-grape p-8 text-paper sm:p-12">
          <div className="relative z-10 max-w-lg">
            <h2 className="font-display text-4xl font-extrabold tracking-tight">
              {inStock.length} colors on the wall
            </h2>
            <p className="mt-3 text-lg text-paper/85">
              Basic, matte, silk, sparkle and translucent. PLA for detail, PETG for toughness, TPU for squish.
            </p>
            <Link href="/colors" className="btn btn-sun mt-6">
              Browse the filament wall
            </Link>
          </div>
          <div className="pointer-events-none absolute top-1/2 -right-10 hidden -translate-y-1/2 grid-cols-5 gap-3 rotate-6 md:grid" aria-hidden="true">
            {inStock.slice(0, 20).map((f, i) => (
              <span key={f.id} className="animate-float" style={{ animationDelay: `${(i % 5) * 0.3}s` }}>
                <SwatchDot filament={f} size={44} className="shadow-[var(--shadow-pop-sm)]" />
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
