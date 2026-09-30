import type { Metadata } from "next";
import { site } from "@/config/site";

/** Page metadata including the text shown when the link is shared (iMessage, Instagram, Facebook, X…). */
export function pageMeta(title: string, description: string, path?: string): Metadata {
  const full = `${title} · ${site.name}`;
  return {
    title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: { title: full, description, siteName: site.name, type: "website", ...(path ? { url: path } : {}) },
    twitter: { card: "summary_large_image", title: full, description },
  };
}
