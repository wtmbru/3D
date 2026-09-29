"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categories, FAMILIES, FINISHES } from "@/data/constants";
import { MAX_COLORS, platesOverLimit } from "@/lib/pricing";
import { clientIp, isThrottled, recordAttempt, requireAdmin } from "@/lib/server/auth";
import { getCatalog, getProducts, toFilamentRow, toProductRow } from "@/lib/server/catalog";
import {
  createSessionToken,
  isAdminConfigured,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/server/session";
import {
  isSupabaseConfigured,
  publicFileUrl,
  STORAGE_BUCKET,
  storagePathFromUrl,
  supabaseAdmin,
} from "@/lib/server/supabase";
import type { Filament, Product, VariantFields } from "@/lib/types";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

/** Run an admin mutation: auth check, database check, friendly errors. */
async function adminAction<T extends object>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    await requireAdmin();
  } catch {
    return fail("Your session expired. Please sign in again.");
  }
  if (!isSupabaseConfigured()) return fail("Connect Supabase first. Changes can't be saved yet.");
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

/** Every storefront page shows catalog data, so refresh them all. */
function refreshStore() {
  revalidatePath("/", "layout");
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(_: unknown, form: FormData): Promise<{ error?: string }> {
  if (!isAdminConfigured()) return { error: "Admin login isn't set up yet. See the setup steps below." };
  const ip = await clientIp();
  if (await isThrottled(ip)) return { error: "Too many attempts. Try again in 15 minutes." };

  const password = String(form.get("password") ?? "");
  const ok = passwordMatches(password);
  await recordAttempt(ip, ok).catch(() => undefined);
  if (!ok) return { error: "That password isn't right." };

  (await cookies()).set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ── Materials ────────────────────────────────────────────────────────────────

const money = z.coerce
  .number()
  .min(0)
  .max(10_000)
  .transform((n) => Math.round(n * 100) / 100);

const materialSchema = z.object({
  family: z.enum(FAMILIES),
  label: z.string().trim().min(1).max(40),
  blurb: z.string().trim().max(200),
  surcharge: money,
});

export async function saveMaterial(input: z.input<typeof materialSchema>): Promise<ActionResult> {
  return adminAction(async () => {
    const m = materialSchema.parse(input);
    const { error } = await supabaseAdmin().from("materials").update(m).eq("family", m.family);
    if (error) throw error;
    refreshStore();
    return { ok: true };
  });
}

// ── Filaments ────────────────────────────────────────────────────────────────

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors must look like #FF8800");

const filamentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60).optional(),
  name: z.string().trim().min(1, "Give the color a name").max(60),
  family: z.enum(FAMILIES),
  finish: z.enum(FINISHES),
  hex,
  hex2: hex.optional().or(z.literal("")),
  brand: z.string().trim().max(60).optional(),
  inStock: z.boolean(),
  surcharge: money,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export async function saveFilament(input: z.input<typeof filamentSchema>): Promise<ActionResult<{ id: string }>> {
  return adminAction(async () => {
    const f = filamentSchema.parse(input);
    const db = supabaseAdmin();
    let id = f.id;
    if (!id) {
      // New filament: derive a readable, permanent id like "pla-cherry-red".
      const base = `${f.family.toLowerCase()}-${slugify(f.name) || "color"}`;
      const { data } = await db.from("filaments").select("id").like("id", `${base}%`);
      const taken = new Set((data ?? []).map((r) => r.id));
      id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    }
    const filament: Filament = {
      id,
      name: f.name,
      family: f.family,
      finish: f.finish,
      hex: f.hex.toUpperCase(),
      ...(f.finish === "silk" && f.hex2 ? { hex2: f.hex2.toUpperCase() } : {}),
      ...(f.brand ? { brand: f.brand } : {}),
      inStock: f.inStock,
      surcharge: f.surcharge,
    };
    const { error } = await db.from("filaments").upsert(toFilamentRow(filament));
    if (error) throw error;
    refreshStore();
    return { ok: true, id };
  });
}

export async function setFilamentStock(id: string, inStock: boolean): Promise<ActionResult> {
  return adminAction(async () => {
    const { error } = await supabaseAdmin().from("filaments").update({ in_stock: inStock }).eq("id", id);
    if (error) throw error;
    refreshStore();
    return { ok: true };
  });
}

export async function deleteFilament(id: string): Promise<ActionResult> {
  return adminAction(async () => {
    // Products store filament ids in jsonb, so check references by hand.
    const products = await getProducts(true);
    const usedBy = products.filter(
      (p) =>
        p.parts.some((part) => part.defaultFilament === id) ||
        p.presets.some((preset) => Object.values(preset.colors).includes(id)),
    );
    if (usedBy.length) {
      return fail(
        `${usedBy.map((p) => p.name).join(", ")} ${usedBy.length === 1 ? "uses" : "use"} this color as a default or in a palette. Change those first, or mark it out of stock instead.`,
      );
    }
    const { error } = await supabaseAdmin().from("filaments").delete().eq("id", id);
    if (error) throw error;
    refreshStore();
    return { ok: true };
  });
}

// ── Products ─────────────────────────────────────────────────────────────────

const coord = z.number().finite().min(-10_000).max(10_000);
const vec3 = z.tuple([coord, coord, coord]);

const partSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Part ids can only use a-z, 0-9 and dashes").max(40),
  name: z.string().trim().min(1, "Every part needs a name").max(40),
  file: z.string().url(),
  defaultFilament: z.string().min(1),
  locked: z.boolean().optional(),
  plate: z.number().int().min(1).max(50).optional(),
  transform: z.object({ position: vec3, rotation: vec3 }).optional(),
});

const idSlug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Option ids can only use a-z, 0-9 and dashes").max(40);
const presetsSchema = z
  .array(z.object({ name: z.string().trim().min(1).max(40), colors: z.record(z.string(), z.string()) }))
  .max(12);
const dimensionsSchema = z.tuple([
  z.coerce.number().int().min(0),
  z.coerce.number().int().min(0),
  z.coerce.number().int().min(0),
]);

const variantSchema = z.object({
  id: idSlug,
  name: z.string().trim().min(1, "Every option needs a name").max(40),
  basePrice: money,
  parts: z.array(partSchema).min(1, "Every option needs at least one model"),
  presets: presetsSchema,
  dimensions: dimensionsSchema,
  layout: z.enum(["assembled", "spread"]).default("assembled"),
});

const addonSchema = z.object({
  id: idSlug,
  name: z.string().trim().min(1, "Every add-on needs a name").max(40),
  choices: z
    .array(z.object({ id: idSlug, name: z.string().trim().min(1, "Every choice needs a name").max(40), price: money }))
    .min(2, "An add-on needs at least two choices (e.g. None and Keyring)")
    .max(10),
});

const productSchema = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "The URL name can only use a-z, 0-9 and single dashes")
    .max(80),
  name: z.string().trim().min(1, "Give the product a name").max(80),
  tagline: z.string().trim().max(140),
  description: z.string().trim().max(4000),
  category: z.enum(categories.map((c) => c.id) as [Product["category"], ...Product["category"][]]),
  basePrice: money,
  materials: z.array(z.enum(FAMILIES)).min(1, "Pick at least one material"),
  parts: z.array(partSchema).min(1, "Upload at least one STL"),
  presets: presetsSchema,
  photos: z.array(z.string().url()).max(12).default([]),
  dimensions: dimensionsSchema,
  leadTimeDays: z.coerce.number().int().min(0).max(90),
  upAxis: z.enum(["z", "y"]).default("z"),
  layout: z.enum(["assembled", "spread"]).default("assembled"),
  featured: z.boolean().default(false),
  badge: z.string().trim().max(24).optional(),
  published: z.boolean(),
  variants: z.array(variantSchema).max(24).default([]),
  variantLabel: z.string().trim().max(24).optional(),
  addons: z.array(addonSchema).max(6).default([]),
});

export type ProductInput = z.input<typeof productSchema>;

/**
 * The editor keeps every product as a list of options, even when there is only
 * one. A single option is just a plain product, so fold it into the top-level
 * fields before validating. (Its name is never shown, so it can be blank.)
 */
function flattenSingleOption(input: ProductInput): ProductInput {
  if (input.variants?.length !== 1) return input;
  const { basePrice, parts, presets, dimensions, layout } = input.variants[0];
  return { ...input, basePrice, parts, presets, dimensions, layout: layout ?? input.layout, variants: [], variantLabel: undefined };
}

export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: string; slug: string }>> {
  return adminAction(async () => {
    const parsed = productSchema.safeParse(flattenSingleOption(input));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Some fields aren't valid.");
    let p = parsed.data as Product;

    // One option is just a plain product; with several, the top-level model
    // fields always mirror the first option.
    if ((p.variants?.length ?? 0) === 1) p = { ...p, ...variantModel(p.variants![0]), variants: [] };
    else if (p.variants?.length) p = { ...p, ...variantModel(p.variants[0]) };
    if (p.variants?.length && new Set(p.variants.map((v) => v.id)).size !== p.variants.length) {
      return fail("Two options have the same id.");
    }
    if (p.addons?.some((g) => new Set(g.choices.map((c) => c.id)).size !== g.choices.length)) {
      return fail("Two add-on choices have the same name.");
    }

    // Only files uploaded to our own storage (no local blob: URLs or outside links).
    const ours = (url: string) => url.startsWith(process.env.SUPABASE_URL!) && !!storagePathFromUrl(url);
    if ((p.photos ?? []).some((u) => !ours(u))) return fail("Some photos haven't finished uploading yet.");
    const { filaments } = await getCatalog();
    const byId = new Map(filaments.map((f) => [f.id, f]));
    const defaultFamily = p.materials[0];

    // Cross-field checks the schema can't express, for every option.
    const models = p.variants?.length ? p.variants.map((v) => ({ ...v, label: ` (${v.name})` })) : [{ ...p, label: "" }];
    for (const m of models) {
      if (new Set(m.parts.map((x) => x.id)).size !== m.parts.length) return fail(`Two parts have the same id${m.label}.`);
      if (m.parts.some((x) => !ours(x.file))) return fail(`Some models haven't finished uploading yet${m.label}.`);
      for (const part of m.parts) {
        const f = byId.get(part.defaultFilament);
        if (!f) return fail(`Pick a default color for "${part.name}"${m.label}.`);
        if (f.family !== defaultFamily) {
          return fail(`"${part.name}"${m.label} defaults to a ${f.family} color, but the first material is ${defaultFamily}.`);
        }
      }
      const over = platesOverLimit(m, Object.fromEntries(m.parts.map((x) => [x.id, x.defaultFilament])));
      if (over.length) {
        return fail(`The default colors for print ${over.join(", ")}${m.label} use more than ${MAX_COLORS} filaments. One print can only use ${MAX_COLORS}.`);
      }
      for (const preset of m.presets) {
        const colors = Object.fromEntries(m.parts.map((x) => [x.id, preset.colors[x.id] ?? x.defaultFilament]));
        if (Object.values(colors).some((id) => !byId.has(id))) return fail(`Palette "${preset.name}"${m.label} uses a color that no longer exists.`);
        if (platesOverLimit(m, colors).length) return fail(`Palette "${preset.name}"${m.label} uses more than ${MAX_COLORS} colors in one print.`);
      }
    }

    const db = supabaseAdmin();
    const { data: clash } = await db.from("products").select("id").eq("slug", p.slug).neq("id", p.id).maybeSingle();
    if (clash) return fail(`Another product already uses the URL name "${p.slug}".`);

    const { data: before } = await db.from("products").select("*").eq("id", p.id).maybeSingle();
    const row: Record<string, unknown> = toProductRow(p);
    // Plain products don't need the options columns, so they keep saving even if
    // the 0002 database update hasn't been run yet (new rows can't tell; omit).
    const usesOptions = (p.variants?.length ?? 0) > 0 || (p.addons?.length ?? 0) > 0 || !!p.variantLabel;
    if (!usesOptions && !(before && "variants" in before)) {
      delete row.variants;
      delete row.variant_label;
      delete row.addons;
    }
    const { error } = await db.from("products").upsert(row);
    if (error) {
      if (/variant|addons/.test(error.message)) {
        throw new Error("The database needs an update: run supabase/migrations/0002_product_options.sql in Supabase's SQL Editor.");
      }
      throw error;
    }

    // Delete files that were replaced or removed (from any option).
    if (before) {
      const files = (x: Pick<Product, "parts" | "photos" | "variants">) => [
        ...x.parts.map((part) => part.file),
        ...(x.variants ?? []).flatMap((v) => v.parts.map((part) => part.file)),
        ...(x.photos ?? []),
      ];
      const keep = new Set(files(p));
      const old = files({ parts: before.parts ?? [], photos: before.photos ?? [], variants: before.variants ?? [] });
      const orphans = old.filter((u) => !keep.has(u)).map(storagePathFromUrl).filter((x): x is string => !!x);
      if (orphans.length) await db.storage.from(STORAGE_BUCKET).remove(orphans);
    }

    refreshStore();
    return { ok: true, id: p.id, slug: p.slug };
  });
}

const variantModel = (v: VariantFields): VariantFields => ({
  basePrice: v.basePrice,
  parts: v.parts,
  presets: v.presets,
  dimensions: v.dimensions,
  layout: v.layout,
});

export async function deleteProduct(id: string): Promise<ActionResult> {
  return adminAction(async () => {
    const db = supabaseAdmin();
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) throw error;
    // Storage listing isn't recursive: clear each upload folder.
    for (const { folder } of Object.values(uploadKinds)) {
      const dir = `products/${id}/${folder}`;
      const { data: files } = await db.storage.from(STORAGE_BUCKET).list(dir, { limit: 1000 });
      if (files?.length) await db.storage.from(STORAGE_BUCKET).remove(files.map((f) => `${dir}/${f.name}`));
    }
    refreshStore();
    return { ok: true };
  });
}

// ── Uploads ──────────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const uploadKinds = {
  // Models are uploaded as gzipped STLs (see meshprep.ts); plain STL still accepted.
  model: { exts: ["stl", "stl.gz"], folder: "models" },
  photo: { exts: ["jpg", "jpeg", "png", "webp"], folder: "photos" },
} as const;

/**
 * Hands the browser a short-lived signed URL so files upload straight to
 * Supabase Storage (serverless functions can't accept 50 MB request bodies).
 */
export async function createUploadUrl(input: {
  productId: string;
  kind: keyof typeof uploadKinds;
  filename: string;
  size: number;
}): Promise<ActionResult<{ signedUrl: string; publicUrl: string }>> {
  return adminAction(async () => {
    const { productId, kind, filename, size } = z
      .object({
        productId: z.string().uuid(),
        kind: z.enum(["model", "photo"]),
        filename: z.string().min(1).max(200),
        size: z.number().int().positive(),
      })
      .parse(input);
    const lower = filename.toLowerCase();
    const ext = lower.endsWith(".stl.gz") ? "stl.gz" : (lower.split(".").pop() ?? "");
    const rules = uploadKinds[kind];
    if (!(rules.exts as readonly string[]).includes(ext)) return fail(`Only ${rules.exts.join(", ")} files are allowed here.`);
    if (size > MAX_UPLOAD_BYTES) return fail("This part is still over 50 MB after optimizing. Try simplifying the model in Bambu Studio.");

    const path = `products/${productId}/${rules.folder}/${randomUUID()}.${ext}`;
    const { data, error } = await supabaseAdmin().storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    return { ok: true, signedUrl: data.signedUrl, publicUrl: publicFileUrl(path) };
  });
}
