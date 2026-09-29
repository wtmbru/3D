-- The colors a customer picked on a custom print request, saved as they were
-- at the time (name, material, finish, color) so later changes to the filament
-- list never rewrite an old request.
--   [{ id, name, family, finish, hex, hex2? }]
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).
alter table public.custom_requests
  add column if not exists colors jsonb not null default '[]'
  check (jsonb_typeof(colors) = 'array');
