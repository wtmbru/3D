"use client";

import { formatPrice } from "@/lib/pricing";
import type { AddonSelection, Product } from "@/lib/types";

/** Price-only extras (keyring, magnet, gift box…), one choice per group. */
export function AddonPicker({
  product,
  selected,
  onChange,
}: {
  product: Product;
  selected: AddonSelection;
  onChange: (next: AddonSelection) => void;
}) {
  return (
    <div className="mt-8 space-y-5">
      {(product.addons ?? []).map((group) => (
        <fieldset key={group.id}>
          <legend className="eyebrow">{group.name}</legend>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={group.name}>
            {group.choices.map((c) => {
              const on = selected[group.id] === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ ...selected, [group.id]: c.id })}
                  className={`chip focus-ring px-4 py-2 text-[15px] transition-transform hover:-translate-y-0.5 ${
                    on ? "bg-ink text-cream" : "bg-paper"
                  }`}
                >
                  {c.name}
                  {c.price > 0 && <span className={on ? "text-cream/70" : "text-ink-soft"}>+{formatPrice(c.price)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
