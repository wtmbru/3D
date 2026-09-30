"use client";

import { DELIVERY_METHODS, type DeliveryMethod, type DeliverySettings, type ShippingAddress } from "@/lib/delivery";
import { formatPrice } from "@/lib/pricing";

export type AddressDraft = Record<keyof ShippingAddress, string>;
export const EMPTY_ADDRESS: AddressDraft = { line1: "", line2: "", city: "", state: "", zip: "" };

/** The address the server expects: trimmed, with an empty second line left out. */
export function toAddress(a: AddressDraft): ShippingAddress {
  return { line1: a.line1.trim(), ...(a.line2.trim() ? { line2: a.line2.trim() } : {}), city: a.city.trim(), state: a.state.trim(), zip: a.zip.trim() };
}

/** Pickup or shipping, with the address fields when shipping is chosen. */
export function DeliveryFields({
  method,
  onMethod,
  address,
  onAddress,
  settings,
  idPrefix = "delivery",
}: {
  method: DeliveryMethod;
  onMethod: (m: DeliveryMethod) => void;
  address: AddressDraft;
  onAddress: (a: AddressDraft) => void;
  settings: DeliverySettings;
  idPrefix?: string;
}) {
  const field = (key: keyof AddressDraft, label: string, props: React.InputHTMLAttributes<HTMLInputElement>, className = "") => (
    <label className={`block ${className}`}>
      <span className="admin-label">{label}</span>
      <input
        className="admin-input"
        value={address[key]}
        onChange={(e) => onAddress({ ...address, [key]: e.target.value })}
        required={key !== "line2"}
        {...props}
      />
    </label>
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Pickup or shipping">
        {DELIVERY_METHODS.map((m) => {
          const on = method === m.id;
          return (
            <label
              key={m.id}
              className={`focus-within:ring-sky cursor-pointer rounded-2xl border-2 p-4 text-center transition-transform hover:-translate-y-0.5 focus-within:ring-[3px] ${
                on ? "border-ink bg-sun shadow-[var(--shadow-pop-sm)]" : "border-ink/20 bg-paper"
              }`}
            >
              <input type="radio" name={`${idPrefix}-method`} value={m.id} checked={on} onChange={() => onMethod(m.id)} className="sr-only" />
              <span className="block font-display text-lg font-extrabold">{m.label}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {m.id === "pickup" ? "Free, we'll arrange a time" : settings.shippingFee > 0 ? `+${formatPrice(settings.shippingFee)} shipping` : "Free shipping"}
              </span>
            </label>
          );
        })}
      </div>

      {method === "pickup" ? (
        <p className="mt-4 text-sm text-ink-soft">{settings.pickupNote || "We'll message you to arrange a pickup time and place."}</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-6">
          {field("line1", "Street address", { autoComplete: "address-line1", maxLength: 120 }, "sm:col-span-6")}
          {field("line2", "Apt, suite, etc. (optional)", { autoComplete: "address-line2", maxLength: 120 }, "sm:col-span-6")}
          {field("city", "City", { autoComplete: "address-level2", maxLength: 80 }, "sm:col-span-3")}
          {field("state", "State", { autoComplete: "address-level1", maxLength: 40 }, "sm:col-span-1")}
          {field("zip", "ZIP code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 10, pattern: "\\d{5}(-\\d{4})?", title: "5-digit ZIP code" }, "sm:col-span-2")}
          <p className="text-sm text-ink-soft sm:col-span-6">We ship within the US. We&apos;ll confirm the shipping details with you.</p>
        </div>
      )}
    </div>
  );
}
