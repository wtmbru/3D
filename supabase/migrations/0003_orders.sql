-- Customer orders (no online payment: customers pay by Zelle / Venmo / Cash App)
-- and small shop settings such as the payment handles.
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).

-- Friendly order numbers: #1001, #1002, …
create sequence if not exists public.order_number_seq start 1001;

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  number          int not null unique default nextval('public.order_number_seq'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  customer_name   text not null check (length(customer_name) between 1 and 120),
  email           text not null check (length(email) between 3 and 200),
  phone           text not null check (length(phone) between 7 and 40),
  payment_method  text not null check (payment_method in ('zelle', 'venmo', 'cashapp')),
  notes           text check (length(notes) <= 1000),

  -- Snapshot of what was ordered (names, colors and prices at order time), so
  -- later catalog edits never change an existing order.
  --   [{ id, productId, slug, name, variantName?, family, qty, unitPrice,
  --      config, parts: [...], addons: [...], status }]
  items           jsonb not null check (jsonb_typeof(items) = 'array'),
  total           numeric(10, 2) not null check (total >= 0),

  payment_status  text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  status          text not null default 'new' check (status in ('new', 'printing', 'ready', 'completed', 'cancelled')),
  admin_notes     text check (length(admin_notes) <= 4000),
  paid_at         timestamptz,
  completed_at    timestamptz,

  -- Salted hash of the customer's IP, used only to limit spam orders.
  ip_hash         text
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_ip_time_idx on public.orders (ip_hash, created_at desc);

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.settings (
  key         text primary key,
  value       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Orders hold customers' contact details: RLS on with no policies means the
-- public API keys can't read or write them. Only the server (secret key) can.
alter table public.orders enable row level security;
alter table public.settings enable row level security;
