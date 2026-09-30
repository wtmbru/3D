-- When a customer accepts a quote, the request becomes an order. This remembers
-- which order came from which request.
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).
alter table public.custom_requests
  add column if not exists order_id uuid references public.orders (id) on delete set null;
