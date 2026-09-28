import type { Metadata } from "next";
import { FilamentManager } from "./FilamentManager";

export const metadata: Metadata = { title: "Filaments" };

export default function FilamentsPage() {
  return (
    <div>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Filaments</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Every spool customers can choose from. Switch a color off when a spool runs out. It stays
        on the site crossed out, and nobody can order it.
      </p>
      <FilamentManager />
    </div>
  );
}
