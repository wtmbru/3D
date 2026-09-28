-- Layer Cake store schema.
-- Run once in the Supabase dashboard (SQL Editor → paste → Run),
-- or with the CLI: supabase db push

-- ── Materials (PLA / PETG / TPU) ────────────────────────────────────────────
create table public.materials (
  family      text primary key check (family in ('PLA', 'PETG', 'TPU')),
  label       text not null,
  blurb       text not null default '',
  surcharge   numeric(8, 2) not null default 0 check (surcharge >= 0),
  sort        int not null default 0
);

-- ── Filaments (the spools on the shelf) ─────────────────────────────────────
create table public.filaments (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null check (length(name) between 1 and 60),
  family      text not null references public.materials (family),
  finish      text not null check (finish in ('basic', 'matte', 'silk', 'translucent', 'sparkle')),
  hex         text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  hex2        text check (hex2 ~ '^#[0-9A-Fa-f]{6}$'),
  brand       text,
  in_stock    boolean not null default true,
  surcharge   numeric(8, 2) not null default 0 check (surcharge >= 0),
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Products ────────────────────────────────────────────────────────────────
-- Parts and presets are small, always loaded with the product, and edited
-- together, so they live in jsonb columns rather than child tables.
--   parts:   [{ id, name, file, defaultFilament, locked?, plate?, transform? }]
--   presets: [{ name, colors: { partId: filamentId } }]
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  tagline         text not null default '',
  description     text not null default '',
  category        text not null check (category in ('figurines', 'home-desk', 'planters', 'accessories')),
  base_price      numeric(8, 2) not null check (base_price >= 0),
  materials       text[] not null default '{PLA}',
  parts           jsonb not null default '[]',
  presets         jsonb not null default '[]',
  photos          text[] not null default '{}',
  dimensions      int[] not null default '{0,0,0}',
  lead_time_days  int not null default 3 check (lead_time_days >= 0),
  up_axis         text not null default 'z' check (up_axis in ('y', 'z')),
  layout          text not null default 'assembled' check (layout in ('assembled', 'spread')),
  featured        boolean not null default false,
  badge           text,
  published       boolean not null default false,
  sort            int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ── Admin login throttling ──────────────────────────────────────────────────
create table public.admin_login_attempts (
  id            bigint generated always as identity primary key,
  ip            text not null,
  succeeded     boolean not null,
  attempted_at  timestamptz not null default now()
);
create index admin_login_attempts_ip_time on public.admin_login_attempts (ip, attempted_at desc);

-- ── Security ────────────────────────────────────────────────────────────────
-- RLS on with no policies = the public API keys can't read or write anything.
-- The app talks to the database only from the server, using the secret key.
alter table public.materials enable row level security;
alter table public.filaments enable row level security;
alter table public.products enable row level security;
alter table public.admin_login_attempts enable row level security;

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Public-read bucket for STL models and product photos. Browsers need to
-- download models to render them, so these are public by design.
-- Uploads only happen through short-lived signed URLs issued by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'products',
  'products',
  true,
  52428800, -- 50 MB (Supabase free-tier max)
  array['model/stl', 'application/sla', 'application/vnd.ms-pki.stl', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
