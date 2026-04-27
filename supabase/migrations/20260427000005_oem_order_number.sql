-- ============================================================================
-- Assign every order an OEM number (OEM000001, OEM000002, ...).
-- Documents (quote / invoice / delivery / receipt) reuse the same number.
-- ============================================================================

create sequence if not exists oem_order_seq start 1;

alter table public.orders
  add column if not exists order_number text;

create unique index if not exists orders_order_number_unique
  on public.orders(order_number);

-- Trigger: assign OEM<6-digit> on insert if not provided
create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_num bigint;
begin
  if new.order_number is null or new.order_number = '' then
    next_num := nextval('oem_order_seq');
    new.order_number := 'OEM' || lpad(next_num::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_assign_number on public.orders;
create trigger trg_orders_assign_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

-- Backfill any existing rows without a number
update public.orders
set order_number = 'OEM' || lpad(nextval('oem_order_seq')::text, 6, '0')
where order_number is null;

-- After backfill, lock the column to NOT NULL
alter table public.orders
  alter column order_number set not null;

-- ============================================================================
-- Add 'delivery' (納品書) to document_type enum
-- ============================================================================
do $$ begin
  alter type document_type add value if not exists 'delivery';
exception when duplicate_object then null; end $$;

-- ============================================================================
-- documents.document_number now mirrors orders.order_number, so multiple
-- documents (quote / invoice / delivery / receipt) for the same order share
-- the same human-readable number. Differentiation is by type.
--
-- Replace the old number-only unique index with a composite (order_id, type)
-- to enforce "one document per type per order".
-- ============================================================================
drop index if exists documents_number_unique;

create unique index if not exists documents_order_type_unique
  on public.documents(order_id, type);
