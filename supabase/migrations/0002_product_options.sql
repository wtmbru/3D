-- Product options (sizes, shapes…) and price-only add-ons.
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).
--   variants: [{ id, name, basePrice, parts, presets, dimensions, layout }]
--             Empty for single-option products. When set, the top-level
--             model columns mirror variants[0].
--   addons:   [{ id, name, choices: [{ id, name, price }] }]
alter table public.products
  add column if not exists variants jsonb not null default '[]',
  add column if not exists variant_label text,
  add column if not exists addons jsonb not null default '[]';
