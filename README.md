# Filamint — 3D print storefront

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

## Branding

The shop name is in `src/config/site.ts` and flows into the header, footer, page titles, link previews and notification emails. The logo starts from one image, `brand/filamint-logo-original.jpg`. To change it, replace that file and run:

```bash
pip install pillow numpy scipy
python3 scripts/brand-assets.py brand/filamint-logo-original.jpg
```

That cuts out the background and regenerates the header icon, the browser tab and home-screen icons, and the link-preview image (`src/assets/brand`, `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `opengraph-image.png`). The name next to the icon is live text in the site font, so it stays sharp on light and dark backgrounds.

## Where things live

| What | Where |
| --- | --- |
| Shop name / tagline | `src/config/site.ts` |
| Colors, fonts, design tokens | `src/app/globals.css` (`@theme` block) |
| Store pages | `src/app/(store)/` |
| Admin panel | `src/app/admin/` (server actions in `actions.ts`) |
| Database reads | `src/lib/server/catalog.ts` |
| Orders (storage, server-side pricing) | `src/lib/server/orders.ts` |
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

**Photos:** in a product's Photos section you can drop files, click to choose, or **paste**. Copy an image (a screenshot, "Copy image" on a web page, a picture from Preview or Photos) and press ⌘V / Ctrl+V anywhere on the page, or click **Paste image**. Up to 12 per product; the first is the cover. A text paste into a text box is never hijacked, even when the clipboard also holds a picture (as from Excel).

**Or use STLs:** export one STL per color region from Bambu Studio (keep Z-up) and drop them all in. They show in the preview immediately and upload in the background.

The importer lives in `src/lib/three/threemf.ts`. The paint decoding follows BambuStudio's `TriangleSelector`.

## Orders (no online payment)

Customers pay by **Zelle, Venmo or Cash App**, so there is no card checkout. The flow:

1. The customer designs items, adds them to the cart and goes to **Checkout**: name, email, phone, payment method and an optional note. Nothing is charged.
2. **Place order** saves it and shows a confirmation page (`/order/<id>`, an unguessable link) with the amount, where to send payment and a progress tracker. The customer can bookmark it.
3. In the admin panel, **Orders** lists every order. The **Orders** tab shows a red count of new ones. Each order page has:
   - **Payment**: Unpaid / Paid / Refunded
   - **Progress**: New → Printing → Ready → Completed (or Cancel)
   - **Print progress** for each item: Queued / Printing / Done. Starting a print moves the order to Printing, and finishing every item moves it to Ready.
   - the exact filament for every part (and which print each is on), the customer's contact details, their note, and her own private notes
4. **Settings** holds the Zelle / Venmo / Cash App details shown on confirmation pages. A blank one tells the customer she'll message them instead.

Safety: the browser only sends *what* was designed. The server rebuilds every order from the live catalog, so prices can't be changed in the browser, locked colors can't be edited, and out-of-stock or unpublished items are refused. Each visitor is limited to 5 orders an hour, and there's a hidden trap field for bots. Orders are stored with the customer's contact details in a table only the server can read.

Setup: run `supabase/migrations/0003_orders.sql` in Supabase's SQL Editor. Without Supabase, local development keeps orders in memory so the flow can be tried offline.

### Order notifications

When an order is placed the shop tells the owner, after the customer already has their confirmation:

- **Email** (Resend, free): the customer, phone, email, payment method, every item with its filament colors, their note, and a button to open the order.
- **Phone notification** (Pushover, about $5 one-time): a short alert that opens the order when tapped.

Each turns on when its settings exist, and a failure never affects the order (it is logged with the order number). Set these in Vercel → Environment Variables, then redeploy:

| Setting | Value |
| --- | --- |
| `RESEND_API_KEY`, `NOTIFY_EMAIL_TO` | Resend API key, and where to send alerts (comma-separate several). With the free shared sender this must be the email you signed up to Resend with. |
| `PUSHOVER_APP_TOKEN`, `PUSHOVER_USER_KEY` | From pushover.net |
| `NOTIFY_EMAIL_FROM` *(optional)* | Only once you've verified your own domain in Resend |
| `SITE_URL` *(optional)* | Base for links in messages; defaults to the Vercel production URL |

Admin → **Settings** shows what's switched on and has a **Send a test** button. Customer confirmation emails aren't sent (they need a domain of your own); the confirmation page and tracking link cover that for now. The code is in `src/lib/server/notify.ts`.

## Custom print requests

For prints a customer found elsewhere (usually MakerWorld). The app can't fetch models from a link (MakerWorld blocks automated access and downloads need a login), so this is a request-and-quote flow with a person in the loop:

1. The customer opens **Custom print** (header, footer, and a card at the bottom of the shop) and sends the link, a message about colors and details, a quantity and their contact info. They get a private page, `/request/<id>`, that shows their request and later her price. They can also tap colors from the filaments she has **in stock** (up to 8); the choice is saved with the request and shown to her, in the alerts and on their page. Names and colors are looked up on the server, and out-of-stock colors are refused.
2. In the admin panel, **Requests** (with a red count of new ones) lists them. Each request has the link (opens safely in a new tab, with a reminder to check the model's license before quoting), the message, and the customer's contact details.
3. She types a **price** (per item) and an optional note, then saves the quote. It appears on the customer's page. **Copy message to send** writes a ready-made text or email with the price and their page link. Saving doesn't send anything by itself.
4. She sets the status: New → Quoted → Accepted (or Declined, where her note is shown as the reason).

Same protections as orders: links must be http(s) (things like `javascript:` are refused), a hidden trap field for bots, and 3 requests an hour per visitor. New requests also trigger the email and phone alerts if you've set those up. Setup: run `supabase/migrations/0004_custom_requests.sql`, then `0005_request_colors.sql` for the color picks (until 0005 is run, requests still work and the picked color names are added to the message instead). When she saves a price, the customer's page shows **Accept quote** and **No thanks** buttons (with a confirm step). Accepting also asks how they'll pay (Zelle, Venmo or Cash App) and **turns the request into a normal order** (with the same number as the request: requests and orders share one counter, so #1004 is never two different things; run `0007_shared_numbers.sql` for that): it appears in Orders with the model link and their message in the note, the customer lands on the usual order page with the payment instructions, and you get the usual new-order alert. Declining just closes the request and alerts you. (Run `0006_request_order_link.sql` so the request keeps a link to its order; without it the order is still made.) If you set a request to Accepted by hand, no order is made. It only works while a quote is waiting on an answer.

**Track your order** (`/track`, linked in the header and footer): customers who lost their link enter their email plus their phone number and/or name. Everything they enter must match what they gave when ordering, an email alone is never enough. It finds both their orders and custom requests and links to each page; no contact details are shown in the results. Guessing is slowed to 8 tries per 10 minutes per visitor. Turning an accepted request into a tracked order isn't built yet.

## Order of products and the homepage spotlight

In **Admin → Products**, drag a row (or use the ▲ ▼ arrows, which also work on phones) to change the order. It saves as you go and is the order customers see in the shop and in "Customer favorites" on the homepage. New products are added at the end.

The **star** picks which print is shown big at the top of the homepage. With no star chosen, the homepage picks one automatically (the first featured product with color palettes, in shop order), and the banner at the top of the list says which. Only live products can be starred. The pick is stored in the `settings` table (`home`), so it needs the orders migration, `0003_orders.sql`.

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
- [x] Order requests with payment by Zelle / Venmo / Cash App, and an admin orders tracker
- [x] Notifications when an order is placed (email + phone push)
- [ ] Confirmation emails to customers (needs your own domain)
- [x] Bambu Studio .3mf import (parts, plates, painting)
- [x] Product options (sizes, shapes) and add-ons

## Text the customer, and link previews

- **Text buttons.** On a request (after saving a quote) and on every order, admin has a button that opens the Messages app (iPhone, or a Mac signed in to Messages) with the customer's number and the text already filled in. Nothing is sent until she presses send. Orders offer ready-made wording for Payment, Printing, Ready and Thanks (the right one is pre-selected for the order's stage) and she can edit it first. On a Mac, texts to non-iPhone customers need Text Message Forwarding turned on on her iPhone.
- **Link previews.** Sharing a product link (iMessage, Instagram, Facebook, X…) shows a card with the product's photo (or its colors if it has no photo), its name and starting price; the other pages have their own titles and descriptions. Previews are built in `src/app/(store)/product/[slug]/opengraph-image.tsx` and `src/lib/meta.ts`; the home page uses the static `src/app/opengraph-image.png`.
- **Search engines.** `/sitemap.xml` lists the shop pages and products; `/robots.txt` keeps the admin, orders, requests, cart and checkout out of search results. Set `SITE_URL` when you get your own domain so all of these use it.

## Weight and cost estimates (private)

Each product's editor has a **Weight & cost** card: for every option and material it shows an estimated weight in grams, what that plastic costs, what the product sells for, and what's left. Customers never see it. It's worked out from the model's volume × the plastic's density × how solid prints usually are × a waste allowance, so treat it as a guide (roughly ±20–30%), not the slicer's number. It covers plastic only, not her time, power or printer wear.

The assumptions live in **Settings → Cost estimates**: what she pays per kilo of PLA, PETG and TPU, how solid her prints are (default 35%, typical for Bambu's default settings) and a waste allowance (default 10%). They're stored in the existing `settings` table, so there's nothing new to run in Supabase. Tip: slice one product in Bambu Studio and compare its real grams with the estimate, then nudge "how solid" until they match.

## Pickup or shipping

At checkout, and when a customer accepts a custom quote, they choose **local pickup** or **ship to me**. Shipping requires a US street address, city, state and ZIP. In **Settings → Pickup & shipping** she sets a flat shipping fee (0 = free) and pickup instructions; the fee is added to shipped orders on the server, never taken from the browser. The address and fee show on the customer's order page, in the admin order (with a **Copy address** button), in the orders list ("Ship 📦" or "Pickup") and in the email and phone alerts. The "ready" text wording changes for shipped orders. Run `supabase/migrations/0008_delivery.sql`: pickup orders keep working without it, but shipped orders need it. Tracking numbers aren't built yet. Customers can also say they want shipping when they **send a custom request**, so she can price the quote knowing it and, when they choose shipping, they give their **address on the request form** so she can price the quote for the destination. The choice and address show in the request (with a Copy address button), the alert and their page, and both are pre-filled when they accept, where they can correct them. Run `0009_request_delivery.sql` and `0010_request_address.sql` for that: without them the request still goes through and the delivery choice and address are added to the message.

Filaments can be deleted straight from the list (a colour used as a product default or in a palette is refused with an explanation; mark it out of stock instead).

## Booth sales (selling in person)

**Admin → Booth** (also a card on the dashboard) tracks local sales, built for using on a phone at a booth. Start a **booth day** (e.g. "Saturday market"), then **add each item once** with what you're selling it for and what it costs to make (typing a name she has sold before, or one of her shop products, fills in its price and cost). From then on it's just big **+1 / +2 / +3 / +5** buttons (and −1) per item. The totals at the top update instantly: **sales, cost and profit**, plus items sold. The Booth page lists every booth day with its totals and an all-time sum. An item can be edited (name, price, cost) or removed, and a whole booth day can be deleted.

It's built for a weak booth signal: every tap shows immediately and is sent in the background. If there's no signal, the page says "N changes not saved yet", keeps them on the phone (even through a reload) and sends them by itself when the signal returns. Saving is idempotent (each item is sent as it is, not as "+1"), so retries can't double-count. The page itself does need a signal to *open*, so open it before you head into a dead zone. Run `supabase/migrations/0011_booth_sales.sql` to set it up. Cost per item is whatever she enters (the Weight & cost card in the product editor can help estimate it).

