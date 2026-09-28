/**
 * Core store types. These mirror the Supabase tables (see supabase/migrations)
 * — the row ↔ type mapping lives in src/lib/server/catalog.ts.
 */

/** Material family — what the printer settings care about. */
export type MaterialFamily = "PLA" | "PETG" | "TPU";

/** Surface finish — what the customer sees. Drives how the 3D preview renders. */
export type Finish = "basic" | "matte" | "silk" | "translucent" | "sparkle";

export interface Filament {
  id: string;
  /** Customer-facing color name, e.g. "Sunflower Yellow". */
  name: string;
  family: MaterialFamily;
  finish: Finish;
  /** Display color for the 3D preview and swatches. */
  hex: string;
  /** Silk has a two-tone shimmer; optional second color for the preview. */
  hex2?: string;
  brand?: string;
  inStock: boolean;
  /** Extra charge (USD) when this filament is used anywhere on a product. */
  surcharge: number;
}

export interface MaterialInfo {
  family: MaterialFamily;
  label: string;
  blurb: string;
  /** Flat surcharge (USD) for printing the whole product in this family. */
  surcharge: number;
}

/**
 * Where a piece sits in the assembled preview, relative to where its STL put
 * it. Viewer space: millimetres, Y-up. Rotation (XYZ Euler, radians) is around
 * the piece's own center.
 */
export interface PartTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface ProductPart {
  /** Stable id, used in cart configs and share links. */
  id: string;
  /** Customer-facing slot name, e.g. "Body", "Eyes". */
  name: string;
  /** Path to the STL for this color region. */
  file: string;
  /** Filament used when the customer hasn't picked one. */
  defaultFilament: string;
  /** If set, the customer can't change this part (e.g. eyes are always black). */
  locked?: boolean;
  /**
   * Which print job this part belongs to (1, 2, …). Parts printed together
   * share one AMS, so the 4-color limit applies per print. Defaults to 1.
   */
  plate?: number;
  /** Placement for the assembled preview. */
  transform?: PartTransform;
}

export interface ColorPreset {
  name: string;
  /** partId → filamentId */
  colors: Record<string, string>;
}

export type Category = "figurines" | "home-desk" | "planters" | "accessories";

export interface Product {
  id: string;
  /** URL name, e.g. "bloop-robot" → /product/bloop-robot */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  /** Starting price (USD) in the default material with standard colors. */
  basePrice: number;
  materials: MaterialFamily[];
  parts: ProductPart[];
  presets: ColorPreset[];
  /** Real print photos. When empty we render a 3D thumbnail instead. */
  photos?: string[];
  /** Printed size in mm, W × D × H. */
  dimensions: [number, number, number];
  /** Days from order to ship. */
  leadTimeDays: number;
  /** Axis pointing up in the STL files. Bambu Studio exports Z-up. */
  upAxis?: "z" | "y";
  /** "assembled": pieces where the STLs (plus transforms) put them. "spread": laid out side by side like a kit. */
  layout?: "assembled" | "spread";
  featured?: boolean;
  badge?: string;
  /** Drafts are only visible in the admin panel. */
  published: boolean;
}

/** partId → filamentId */
export type ColorConfig = Record<string, string>;

/** The filament wall + material settings, shared with client components. */
export interface Catalog {
  filaments: Filament[];
  materials: MaterialInfo[];
}
