import type { Metadata } from "next";
import { listBoothSessions } from "@/lib/server/booth";
import { BoothList } from "./BoothList";

export const metadata: Metadata = { title: "Booth sales" };

export default async function BoothPage() {
  let sessions;
  try {
    sessions = await listBoothSessions();
  } catch (e) {
    return (
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Booth sales</h1>
        <p role="alert" className="mt-6 rounded-2xl bg-sun-soft px-4 py-3 font-semibold">
          {e instanceof Error ? e.message : "Couldn't load booth days."}
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Booth sales</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Selling in person? Start a booth day, add what you sell once, then tap +1, +2 or +3 as you make sales. It keeps track of your sales, costs and profit.
      </p>
      <BoothList sessions={sessions} />
    </div>
  );
}
