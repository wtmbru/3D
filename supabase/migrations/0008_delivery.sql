-- Pickup or shipping on orders. Shipping orders carry the customer's address and
-- the shipping fee that was charged (already included in the order total).
-- Existing orders become local pickup.
-- Run once in the Supabase dashboard (SQL Editor → paste → Run).
alter table public.orders
  add column if not exists delivery_method text not null default 'pickup'
    check (delivery_method in ('pickup', 'shipping')),
  add column if not exists shipping_address jsonb
    check (shipping_address is null or jsonb_typeof(shipping_address) = 'object'),
  add column if not exists shipping_fee numeric(10, 2) not null default 0
    check (shipping_fee >= 0);

-- A shipping order must have an address.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_shipping_needs_address') then
    alter table public.orders
      add constraint orders_shipping_needs_address
      check (delivery_method <> 'shipping' or shipping_address is not null);
  end if;
end $$;
