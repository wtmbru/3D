import type { Metadata } from "next";
import { listRequests } from "@/lib/server/requests";
import { RequestsList } from "./RequestsList";

export const metadata: Metadata = { title: "Custom requests" };

export default async function RequestsPage() {
  let requests;
  try {
    requests = await listRequests();
  } catch (e) {
    return (
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Custom requests</h1>
        <p role="alert" className="mt-6 rounded-2xl bg-sun-soft px-4 py-3 font-semibold">
          {e instanceof Error ? e.message : "Couldn't load requests."}
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Custom requests</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Customers send a link to a print and tell you the colors they want. Open one, check the model, and send back a price.
      </p>
      <RequestsList requests={requests} />
    </div>
  );
}
