"use client";

import { createContext, useContext } from "react";
import type { Catalog } from "@/lib/types";

const CatalogContext = createContext<Catalog | null>(null);

/** Makes the filament wall available to client components (loaded once on the server). */
export function CatalogProvider({ catalog, children }: { catalog: Catalog; children: React.ReactNode }) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Catalog {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return catalog;
}
