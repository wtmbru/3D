-- Whether the customer wants local pickup or shipping, chosen when they send a custom
-- print request so the quote can account for it. (The address is collected later, when
-- they accept the quote and it becomes an order.) Existing requests become pickup.
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).
alter table public.custom_requests
  add column if not exists delivery text not null default 'pickup'
  check (delivery in ('pickup', 'shipping'));
