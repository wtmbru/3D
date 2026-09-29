/**
 * Loads the starter catalog into Supabase: materials, filaments, and the
 * sample products (uploading their STLs from public/models to Storage).
 *
 * Safe to re-run: rows are upserted, and products that already exist
 * (by slug) are skipped so edits made in the admin panel aren't overwritten.
 *
 * Run: npm run seed
 * Only some products: npm run seed -- stud-brick-charm bloop-robot
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { seedFilaments, seedMaterials } from "../src/data/seed/filaments";
import { seedProducts } from "../src/data/seed/products";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
  process.exit(1);
}

const BUCKET = "products";
const db = createClient(url, key, { auth: { persistSession: false } });

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`✗ ${what}: ${res.error.message}`);
    if (res.error.message.includes("does not exist") || res.error.message.includes("schema cache")) {
      console.error("  Did you run supabase/migrations/0001_init.sql first?");
    }
    process.exit(1);
  }
  return res.data;
}

async function main() {
  check(
    await db.from("materials").upsert(
      seedMaterials.map((m, sort) => ({ ...m, sort })),
      { ignoreDuplicates: true },
    ),
    "materials",
  );
  console.log(`✓ ${seedMaterials.length} materials`);

  check(
    await db.from("filaments").upsert(
      seedFilaments.map((f, sort) => ({
        id: f.id,
        name: f.name,
        family: f.family,
        finish: f.finish,
        hex: f.hex,
        hex2: f.hex2 ?? null,
        brand: f.brand ?? null,
        in_stock: f.inStock,
        surcharge: f.surcharge,
        sort,
      })),
      { ignoreDuplicates: true },
    ),
    "filaments",
  );
  console.log(`✓ ${seedFilaments.length} filaments`);

  const existing = new Set((check(await db.from("products").select("slug"), "products") ?? []).map((r) => r.slug));

  const only = process.argv.slice(2);
  for (const [sort, p] of seedProducts.entries()) {
    if (only.length && !only.includes(p.slug)) continue;
    if (existing.has(p.slug)) {
      console.log(`· ${p.name} already exists, skipping`);
      continue;
    }
    const id = randomUUID();
    // Upload each local model once, even when several options share it.
    const uploaded = new Map<string, string>();
    const uploadParts = async (list: typeof p.parts) => {
      const out = [];
      for (const part of list) {
        if (!uploaded.has(part.file)) {
          const local = path.join(process.cwd(), "public", part.file);
          const storagePath = `products/${id}/models/${randomUUID()}.stl`;
          check(
            await db.storage.from(BUCKET).upload(storagePath, fs.readFileSync(local), {
              contentType: "model/stl",
              cacheControl: "31536000",
            }),
            `upload ${part.file}`,
          );
          uploaded.set(part.file, db.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl);
        }
        out.push({ ...part, file: uploaded.get(part.file)! });
      }
      return out;
    };
    const parts = await uploadParts(p.parts);
    const variants = [];
    for (const v of p.variants ?? []) variants.push({ ...v, parts: await uploadParts(v.parts) });
    check(
      await db.from("products").insert({
        id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        category: p.category,
        base_price: p.basePrice,
        materials: p.materials,
        parts,
        presets: p.presets,
        photos: p.photos ?? [],
        dimensions: p.dimensions,
        lead_time_days: p.leadTimeDays,
        up_axis: p.upAxis ?? "z",
        layout: p.layout ?? "assembled",
        featured: !!p.featured,
        badge: p.badge ?? null,
        published: p.published,
        sort,
        // Options columns need migration 0002; only send them when used.
        ...(variants.length ? { variants, variant_label: p.variantLabel ?? null } : {}),
        ...(p.addons?.length ? { addons: p.addons } : {}),
      }),
      `product ${p.name}`,
    );
    console.log(`✓ ${p.name} (${uploaded.size} models uploaded${variants.length ? `, ${variants.length} options` : ""})`);
  }
  console.log("\nDone! Open /admin to see everything.");
}

main();
