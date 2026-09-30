import type { Metadata } from "next";
import { TrackForm } from "@/components/TrackForm";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta(
  "Track your order",
  "Find your order or custom print request with your email and phone number or name.",
  "/track",
);

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Track</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Find your order</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-soft">
        Lost the link? Enter your email plus your phone number or name and we&apos;ll show your orders and custom requests.
      </p>
      <TrackForm />
    </div>
  );
}
