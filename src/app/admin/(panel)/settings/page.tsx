import type { Metadata } from "next";
import { getPaymentSettings } from "@/lib/server/orders";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  return (
    <div>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Where customers should send payment. These appear on their order confirmation page. Leave one blank if you
        don&apos;t accept it. Customers will then be told you&apos;ll message them the details.
      </p>
      <SettingsForm initial={await getPaymentSettings()} />
    </div>
  );
}
