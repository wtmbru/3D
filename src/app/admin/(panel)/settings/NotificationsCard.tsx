"use client";

import { useState, useTransition } from "react";
import type { ChannelResult, notificationStatus } from "@/lib/server/notify";
import { sendTestNotifications } from "../../order-actions";

type Status = ReturnType<typeof notificationStatus>;

const CHANNEL_NAME = { email: "Email", push: "Phone notification" } as const;

export function NotificationsCard({ status }: { status: Status }) {
  const [results, setResults] = useState<ChannelResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const anyOn = status.email.configured || status.push.configured;

  return (
    <section className="admin-card mt-8 max-w-2xl space-y-5" aria-label="Notifications">
      <div>
        <h2 className="admin-h2">Order notifications</h2>
        <p className="mt-1 text-sm text-ink-soft">Get told the moment an order is placed, so nothing sits unnoticed.</p>
      </div>

      <ul className="space-y-2">
        <Row
          name="Email"
          on={status.email.configured}
          detail={
            status.email.configured
              ? `Sending to ${status.email.to.join(", ")}`
              : status.email.hasKey
                ? "Add NOTIFY_EMAIL_TO to turn this on."
                : "Not set up yet."
          }
        />
        <Row name="Phone notification" on={status.push.configured} detail={status.push.configured ? "Pushover is connected." : "Not set up yet."} />
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending || !anyOn}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await sendTestNotifications();
              if (res.ok) setResults(res.results);
              else setError(res.error);
            })
          }
        >
          {pending ? "Sending…" : "Send a test"}
        </button>
        {!anyOn && <span className="text-sm text-ink-soft">Set one up below first.</span>}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-tomato-soft px-3 py-2 text-sm font-semibold">
          {error}
        </p>
      )}
      {results && (
        <ul className="space-y-1.5" aria-live="polite">
          {results
            .filter((r) => r.status !== "skipped")
            .map((r) => (
              <li
                key={r.channel}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${r.status === "sent" ? "bg-mint-soft" : "bg-tomato-soft"}`}
              >
                {r.status === "sent"
                  ? `${CHANNEL_NAME[r.channel]}: sent! Check your ${r.channel === "email" ? "inbox (and spam)" : "phone"}.`
                  : `${CHANNEL_NAME[r.channel]} failed: ${r.detail}`}
              </li>
            ))}
        </ul>
      )}

      <details className="rounded-2xl border-2 border-ink/15 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">How to set these up</summary>
        <div className="mt-3 space-y-4 text-ink-soft">
          <p>
            These are private settings, so they live in Vercel (Project → Settings → Environment Variables), not on this page.
            After adding them, redeploy once (Deployments → ⋯ → Redeploy), then press <strong>Send a test</strong>.
          </p>
          <div>
            <p className="font-bold text-ink">Email (free)</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Make a free account at resend.com using the email address where you want alerts.</li>
              <li>Open API Keys and create one. Add it as <code>RESEND_API_KEY</code>.</li>
              <li>
                Add <code>NOTIFY_EMAIL_TO</code> with that same email address. (Without your own domain, Resend can only deliver to the
                address you signed up with.)
              </li>
            </ol>
          </div>
          <div>
            <p className="font-bold text-ink">Phone notification (Pushover, about $5 once)</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Make an account at pushover.net and install the Pushover app on your phone.</li>
              <li>Your dashboard shows a <em>User Key</em>. Add it as <code>PUSHOVER_USER_KEY</code>.</li>
              <li>Create an Application there. Add its <em>API Token</em> as <code>PUSHOVER_APP_TOKEN</code>.</li>
            </ol>
          </div>
        </div>
      </details>
    </section>
  );
}

function Row({ name, on, detail }: { name: string; on: boolean; detail: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-extrabold ${on ? "bg-mint" : "bg-cream-deep text-ink-faint"}`}
        aria-hidden="true"
      >
        {on ? "✓" : ""}
      </span>
      <span className="text-sm">
        <span className="font-semibold">{name}: {on ? "on" : "off"}</span>
        <span className="text-ink-soft"> · {detail}</span>
      </span>
    </li>
  );
}
