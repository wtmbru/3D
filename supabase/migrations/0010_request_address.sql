-- The shipping address a customer gives when they send a custom print request, so the
-- quote can take the destination into account. It's copied into the order when they
-- accept. Only filled in for requests that want shipping.
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).
alter table public.custom_requests
  add column if not exists shipping_address jsonb
  check (shipping_address is null or jsonb_typeof(shipping_address) = 'object');
