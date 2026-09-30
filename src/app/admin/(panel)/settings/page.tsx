import type { Metadata } from "next";
import { notificationStatus } from "@/lib/server/notify";
import { getPaymentSettings } from "@/lib/server/orders";
import { getCostSettings, getDeliverySettings } from "@/lib/server/settings";
import { DeliveryCard } from "./DeliveryCard";
import { CostSettingsCard } from "./CostSettingsCard";
import { NotificationsCard } from "./NotificationsCard";
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
      <DeliveryCard initial={await getDeliverySettings()} />
      <NotificationsCard status={notificationStatus()} />
      <CostSettingsCard initial={await getCostSettings()} />
    </div>
  );
}
