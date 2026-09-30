import type { Metadata } from "next";
import { CustomRequestForm } from "@/components/custom/CustomRequestForm";
import { pageMeta } from "@/lib/meta";
import { getDeliverySettings } from "@/lib/server/settings";

export const metadata: Metadata = pageMeta(
  "Custom print",
  "Found a print you love? Send us the link and tell us your colors. We'll reply with a price.",
  "/custom",
);

export default async function CustomPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Custom print</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight text-balance">Found a print you love?</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Send us the link and tell us how you&apos;d like it: colors, size, how many. We&apos;ll take a look and reply with a
        price. There&apos;s nothing to pay until you say yes.
      </p>
      <CustomRequestForm delivery={await getDeliverySettings()} />
    </div>
  );
}
