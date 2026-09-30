-- One set of numbers for custom requests and orders, so "#1004" never means two
-- different things. New requests now take their number from the same counter as
-- orders, and the order made from a request keeps the request's number.
-- Existing requests keep the numbers they already have.
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).
alter table public.custom_requests
  alter column number set default nextval('public.order_number_seq');
