-- Custom print requests: a customer sends a link to a model (usually MakerWorld)
-- plus a message about colors and details; the shop reviews it and replies with
-- a price. Run once in the Supabase dashboard (SQL Editor → paste → Run).

create sequence if not exists public.request_number_seq start 101;

create table public.custom_requests (
  id              uuid primary key default gen_random_uuid(),
  -- Friendly number shown to people: 101, 102, …
  number          int not null unique default nextval('public.request_number_seq'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  customer_name   text not null check (length(customer_name) between 1 and 120),
  email           text not null check (length(email) between 3 and 200),
  phone           text not null check (length(phone) between 7 and 40),

  model_url       text not null check (length(model_url) between 8 and 600 and model_url ~* '^https?://'),
  message         text not null check (length(message) between 1 and 3000),
  quantity        int not null default 1 check (quantity between 1 and 500),

  status          text not null default 'new' check (status in ('new', 'quoted', 'accepted', 'declined')),
  -- The shop's reply.
  quote_price     numeric(10, 2) check (quote_price >= 0),
  quote_note      text check (length(quote_note) <= 2000),
  quoted_at       timestamptz,
  admin_notes     text check (length(admin_notes) <= 4000),

  -- Salted hash of the customer's IP, used only to limit spam requests.
  ip_hash         text
);

create index custom_requests_created_idx on public.custom_requests (created_at desc);
create index custom_requests_status_idx on public.custom_requests (status);
create index custom_requests_ip_time_idx on public.custom_requests (ip_hash, created_at desc);

create trigger custom_requests_touch before update on public.custom_requests
  for each row execute function public.touch_updated_at();

-- Contains customers' contact details: RLS on with no policies means only the
-- server (secret key) can read or write it.
alter table public.custom_requests enable row level security;
