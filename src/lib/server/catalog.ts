import "server-only";
import { cache } from "react";
import { seedFilaments, seedMaterials } from "@/data/seed/filaments";
import { seedProducts } from "@/data/seed/products";
import type { Catalog, Filament, MaterialInfo, Product } from "@/lib/types";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";

/*
 * All catalog reads go through here. Without Supabase configured, the store
 * runs read-only on the seed data so it can be developed and demoed.
 */

type MaterialRow = { family: string; label: string; blurb: string; surcharge: string | number; sort: number };
type FilamentRow = {
  id: string;
  name: string;
  family: string;
  finish: string;
  hex: string;
  hex2: string | null;
  brand: string | null;
  in_stock: boolean;
  surcharge: string | number;
  sort: number;
};
export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  base_price: string | number;
  materials: string[];
  parts: Product["parts"];
  presets: Product["presets"];
  photos: string[];
  dimensions: number[];
  lead_time_days: number;
  up_axis: string;
  layout: string;
  featured: boolean;
  badge: string | null;
  published: boolean;
  sort: number;
  // Added in migration 0002; absent until it has been run.
  variants?: Product["variants"];
  variant_label?: string | null;
  addons?: Product["addons"];
};

const toMaterial = (r: MaterialRow): MaterialInfo => ({
  family: r.family as MaterialInfo["family"],
  label: r.label,
  blurb: r.blurb,
  surcharge: Number(r.surcharge),
});

const toFilament = (r: FilamentRow): Filament => ({
  id: r.id,
  name: r.name,
  family: r.family as Filament["family"],
  finish: r.finish as Filament["finish"],
  hex: r.hex,
  ...(r.hex2 ? { hex2: r.hex2 } : {}),
  ...(r.brand ? { brand: r.brand } : {}),
  inStock: r.in_stock,
  surcharge: Number(r.surcharge),
});

export const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  description: r.description,
  category: r.category as Product["category"],
  basePrice: Number(r.base_price),
  materials: r.materials as Product["materials"],
  parts: r.parts ?? [],
  presets: r.presets ?? [],
  photos: r.photos ?? [],
  dimensions: [r.dimensions[0] ?? 0, r.dimensions[1] ?? 0, r.dimensions[2] ?? 0],
  leadTimeDays: r.lead_time_days,
  upAxis: r.up_axis as Product["upAxis"],
  layout: r.layout as Product["layout"],
  featured: r.featured,
  ...(r.badge ? { badge: r.badge } : {}),
  published: r.published,
  ...(r.variants?.length ? { variants: r.variants } : {}),
  ...(r.variant_label ? { variantLabel: r.variant_label } : {}),
  ...(r.addons?.length ? { addons: r.addons } : {}),
});

export function toProductRow(p: Product): Omit<ProductRow, "sort"> {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    category: p.category,
    base_price: p.basePrice,
    materials: p.materials,
    parts: p.parts,
    presets: p.presets,
    photos: p.photos ?? [],
    dimensions: p.dimensions,
    lead_time_days: p.leadTimeDays,
    up_axis: p.upAxis ?? "z",
    layout: p.layout ?? "assembled",
    featured: !!p.featured,
    badge: p.badge || null,
    published: p.published,
    variants: p.variants ?? [],
    variant_label: p.variantLabel || null,
    addons: p.addons ?? [],
  };
}

export function toFilamentRow(f: Filament) {
  return {
    id: f.id,
    name: f.name,
    family: f.family,
    finish: f.finish,
    hex: f.hex,
    hex2: f.hex2 ?? null,
    brand: f.brand ?? null,
    in_stock: f.inStock,
    surcharge: f.surcharge,
  };
}

/**
 * Run a read query, retrying briefly on errors. A momentary hiccup on Supabase's
 * side (seen once as "JWT issued at future", a clock blip) shouldn't fail a page
 * or, worse, a deployment, since some pages read the catalog while being built.
 */
async function read<T>(
  what: string,
  query: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await query();
    if (!res.error) return res.data as T;
    last = res.error.message;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(`Loading ${what} failed: ${last}`);
}

/** Filaments + materials. Cached per request. */
export const getCatalog = cache(async (): Promise<Catalog> => {
  if (!isSupabaseConfigured()) return { filaments: seedFilaments, materials: seedMaterials };
  const db = supabaseAdmin();
  const [materials, filaments] = await Promise.all([
    read<MaterialRow[]>("materials", () => db.from("materials").select("*").order("sort")),
    read<FilamentRow[]>("filaments", () => db.from("filaments").select("*").order("sort").order("created_at")),
  ]);
  return { materials: materials.map(toMaterial), filaments: filaments.map(toFilament) };
});

/** Products, including drafts only when asked (admin). Cached per request. */
export const getProducts = cache(async (includeDrafts = false): Promise<Product[]> => {
  if (!isSupabaseConfigured()) return seedProducts.filter((p) => includeDrafts || p.published);
  const rows = await read<ProductRow[]>("products", () => {
    const q = supabaseAdmin().from("products").select("*").order("sort").order("created_at");
    return includeDrafts ? q : q.eq("published", true);
  });
  return rows.map(toProduct);
});

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return (await getProducts()).find((p) => p.slug === slug);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  return (await getProducts(true)).find((p) => p.id === id);
}
