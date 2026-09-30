-- Local / booth sales tracking. A "booth day" holds the items sold that day: each item has
-- what it sold for, what it cost to make, and how many were sold (the +1 / +2 / +3 taps).
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).

create table public.booth_sessions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (length(name) between 1 and 120),
  day         date not null default current_date,
  notes       text check (length(notes) <= 1000)
);

create table public.booth_items (
  -- Made by the app (not the database) so an item added with a weak signal is safe to send twice.
  id          uuid primary key,
  session_id  uuid not null references public.booth_sessions (id) on delete cascade,
  created_at  timestamptz not null default now(),
  name        text not null check (length(name) between 1 and 120),
  price       numeric(10, 2) not null check (price >= 0),
  cost        numeric(10, 2) not null default 0 check (cost >= 0),
  qty         int not null default 0 check (qty between 0 and 100000)
);

create index booth_sessions_day_idx on public.booth_sessions (day desc, created_at desc);
create index booth_items_session_idx on public.booth_items (session_id, created_at);

-- Private shop data: RLS on with no policies means only the server (secret key) can use it.
alter table public.booth_sessions enable row level security;
alter table public.booth_items enable row level security;
