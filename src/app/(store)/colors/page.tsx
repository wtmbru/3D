import type { Metadata } from "next";
import { swatchBackground } from "@/components/Swatch";
import { finishLabels } from "@/data/constants";
import { getCatalog } from "@/lib/server/catalog";
import { formatPrice } from "@/lib/pricing";
import type { Filament } from "@/lib/types";

export const metadata: Metadata = { title: "Filament colors" };

export default async function ColorsPage() {
  const { filaments, materials } = await getCatalog();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The filament wall</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Our colors</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-soft">
        Every spool we have on the shelf right now. Screens can&apos;t fully capture silk shine or
        sparkle, so real prints will look even better.
      </p>

      <div className="mt-12 space-y-16">
        {materials.map((m) => {
          const inFamily = filaments.filter((f) => f.family === m.family);
          const finishes = [...new Set(inFamily.map((f) => f.finish))];
          return (
            <section key={m.family} aria-labelledby={`mat-${m.family}`}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 id={`mat-${m.family}`} className="font-display text-3xl font-extrabold">
                  {m.label}
                </h2>
                {m.surcharge > 0 && <span className="chip bg-sun-soft text-xs">+{formatPrice(m.surcharge)} per item</span>}
              </div>
              <p className="mt-1 text-ink-soft">{m.blurb}</p>
              {finishes.map((finish) => (
                <div key={finish} className="mt-6">
                  <h3 className="eyebrow">{finishLabels[finish]}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {inFamily
                      .filter((f) => f.finish === finish)
                      .map((f) => (
                        <SpoolCard key={f.id} filament={f} />
                      ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SpoolCard({ filament: f }: { filament: Filament }) {
  return (
    <div className={`chunky overflow-hidden rounded-3xl bg-paper ${f.inStock ? "" : "opacity-60"}`}>
      <div className="relative aspect-[4/3] border-b-2 border-ink" style={swatchBackground(f)}>
        {!f.inStock && (
          <span className="chip absolute top-2 left-2 rotate-[-4deg] bg-paper text-xs">Out of stock</span>
        )}
        {f.surcharge > 0 && (
          <span className="chip absolute right-2 bottom-2 bg-paper text-xs">+{formatPrice(f.surcharge)}</span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="leading-tight font-display font-bold">{f.name}</p>
        <p className="text-xs text-ink-soft">
          {f.family} · {finishLabels[f.finish]}
        </p>
      </div>
    </div>
  );
}
