# Layer Cake — 3D print storefront

A storefront where customers pick a 3D-printed design, recolor each part in a live 3D preview using real filament colors, and add it to the cart. The owner manages products, filaments and prices in a password-protected admin panel at `/admin`.

Stack: Next.js 16 (App Router) · Tailwind CSS v4 · React Three Fiber / three.js · Supabase (Postgres + Storage) · Zustand (cart).

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run dev                  # http://localhost:3000, admin at /admin
```

Without Supabase configured, the store runs **read-only on the sample catalog** in `src/data/seed/`. That's handy for design work. The admin panel works but can't save.

## Connect Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste all of `supabase/migrations/0001_init.sql` → **Run**, then do the same with `0002_product_options.sql`. This creates the tables, locks them down with row-level security, and creates the `products` storage bucket.
3. **Project Settings → API Keys**: copy the project URL and the **secret** key into `.env.local`:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
   The secret key bypasses all security rules. It's only ever used on the server. Never put it in client code or share it.
4. Set the admin login in `.env.local`:
   ```
   ADMIN_PASSWORD=<a long password>
   ADMIN_SESSION_SECRET=<output of: openssl rand -base64 32>
   ```
5. `npm run seed` loads the sample materials, filaments and products (and uploads their STLs). It's safe to re-run: it never overwrites things edited in the admin panel.
6. Restart `npm run dev`.

When deploying to Vercel, add the same four variables under **Settings → Environment Variables**.

## Where things live

| What | Where |
| --- | --- |
| Shop name / tagline | `src/config/site.ts` |
| Colors, fonts, design tokens | `src/app/globals.css` (`@theme` block) |
| Store pages | `src/app/(store)/` |
| Admin panel | `src/app/admin/` (server actions in `actions.ts`) |
| Database reads | `src/lib/server/catalog.ts` |
| Admin auth | `src/lib/server/session.ts`, `auth.ts`, `src/proxy.ts` |
| Pricing rules (4-color limit, per-color fee) | `src/lib/pricing.ts` |
| 3D loading, materials per finish | `src/lib/three/models.ts` |
| Product page color picker | `src/components/configurator/` |
| Database schema | `supabase/migrations/` |

## How the admin panel works

- **Login:** one password (`ADMIN_PASSWORD`). A successful login sets a signed, httpOnly cookie that lasts 2 weeks. Failed logins are rate-limited per IP (8 per 15 minutes). `/admin/*` pages redirect to the login page, and every server action checks the session again, since actions are public HTTP endpoints.
- **Uploads:** STLs and photos upload straight from the browser to Supabase Storage using short-lived signed URLs from the server. Vercel functions can't accept 50 MB request bodies, so the files skip the server. STLs are parsed in the browser first, so broken files are caught before they upload.
- **Saving:** every save revalidates the storefront, so changes are live immediately. Replaced or removed files are deleted from storage.
- **Drafts:** products start as drafts, which are only visible in the admin panel, until published.

## Adding a product

**Easiest: import the Bambu Studio project.** Set the model up in Bambu Studio the way you'd print it (colors, painting, plates), then **File → Save Project** to get a `.3mf`. Drop it into `/admin/products/new`. The import brings in:

- every part in its real position, so there's no assembling
- the filament slot each part uses, with its color matched to the closest filament on your wall
- painted colors (from the paint tool)
- plates, which become separate prints
- the project title as the product name

Choose whether customers recolor **each filament color** (best for painted models) or **each part separately**, then name the parts, set the price, and publish. Modifier, negative and support parts are skipped. When a plate holds several copies of an object, one copy is imported. OrcaSlicer and PrusaSlicer projects work too.

**Or use STLs:** export one STL per color region from Bambu Studio (keep Z-up) and drop them all in. They show in the preview immediately and upload in the background.

The importer lives in `src/lib/three/threemf.ts`. The paint decoding follows BambuStudio's `TriangleSelector`.

## Options and add-ons

- **Options** (sizes, shapes, versions): each option has its own model, price, palettes and size. Customers pick one on the product page, colors carry over between options when part names match, and product cards show a badge like "4 sizes". Manage them in the product editor's **Options** card. The purple strip at the top shows which option you're editing.
- **From one .3mf:** drop in a file with several objects (like a MakerWorld download with every size on one plate). The import looks at how the objects are laid out and named, and suggests **One model**, **Options to choose from**, or **A set sold together**, with a preview of each object and the reason for its suggestion. It can also add a "Full set" option.
- **Add-ons** (keyring, magnet, gift box…): price-only extras, managed in the **Add-ons** card. The first choice is the default.
- Options need the database update in `supabase/migrations/0002_product_options.sql`.

## Pieces printed separately

- **Prints:** give each part a print number. Parts that print together share one AMS, so the 4-color limit and the extra-color fee apply per print. A glued-on hat can be "Print 2" with its own 4 colors.
- **Arrange pieces:** separate prints are usually exported flat at the origin, so they pile up. Click **Arrange pieces** in the product editor, then **Spread out**, then click each piece and move or rotate it into place. The ↻ buttons turn a piece 90°, and **Drop to floor** rests it on the ground. For fine tuning, type exact **Position** (mm) and **Rotation** (°) values for the selected piece, or nudge them with −/+ or the ↑ ↓ keys (hold Shift for 10× steps). **Move snap** and **Turn snap** choose the drag step; set either to **Free** for smooth, unsnapped dragging. Placements are saved with the product, and customers see the assembled model.
- **Kits and sets:** set **Show pieces → Laid out side by side** to display the pieces next to each other instead.

## How pricing works

`option's base price + material surcharge + $1 per extra color (per print) + any filament surcharges (matte/silk/etc.) + add-ons`. It's computed in `quote()` in `src/lib/pricing.ts`, and the product page shows the breakdown. Cart items store only the design (product, option, material, colors, add-ons), and the price is recomputed from the catalog. Checkout must recompute it on the server too.

## Scripts

- `npm run seed`: load the sample catalog into Supabase (`npm run seed -- stud-brick-charm` loads just one product)
- `npm run models`: regenerate the sample STLs in `public/models`
- `npm run typecheck` / `npm run lint`

## Roadmap

- [x] Storefront + 3D color picker
- [x] Admin panel: products, filaments, materials, photos
- [ ] Checkout with Stripe (recompute price server-side), order emails
- [ ] Orders dashboard showing the exact filament per part
- [x] Bambu Studio .3mf import (parts, plates, painting)
- [x] Product options (sizes, shapes) and add-ons
