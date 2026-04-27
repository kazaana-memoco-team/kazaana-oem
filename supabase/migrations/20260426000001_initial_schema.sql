-- ============================================================================
-- Initial schema for kazaana-oem
-- ============================================================================
-- Tables:
--   profiles       — common user profile, 1:1 with auth.users
--   craftsmen      — craftsman-specific extension of profiles
--   orders         — core OEM orders (both A: product customize, B: full custom)
--   messages       — per-order chat messages
--   order_events   — status change / audit log
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMs (idempotent: skip if already exist)
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('customer', 'craftsman', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_type as enum ('product_customize', 'full_custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'draft',
    'awaiting_quote',
    'quoted',
    'paid',
    'in_production',
    'shipped',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  display_name text,
  avatar_url text,
  contact_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile + admins can read all
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Users can update their own profile
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Insert handled by trigger only (see below)

-- ----------------------------------------------------------------------------
-- craftsmen (extension of profiles)
-- ----------------------------------------------------------------------------
create table public.craftsmen (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  specialties text[] not null default '{}',
  bio text,
  portfolio_urls text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.craftsmen enable row level security;

-- Anyone authenticated can browse active craftsmen (for matching)
create policy "craftsmen_select_active" on public.craftsmen
  for select using (
    is_active = true
    or auth.uid() = profile_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "craftsmen_update_own" on public.craftsmen
  for update using (auth.uid() = profile_id);

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  assigned_craftsman_id uuid references public.profiles(id) on delete set null,
  type order_type not null,
  status order_status not null default 'draft',

  -- Phase A (product_customize)
  shopify_product_id text,
  shopify_variant_id text,

  -- Phase B (full_custom)
  reference_images text[] not null default '{}',

  -- Common
  customization jsonb not null default '{}'::jsonb,
  estimated_price numeric(10, 0),
  final_price numeric(10, 0),

  -- Shopify integration
  shopify_draft_order_id text,
  shopify_order_id text,
  checkout_url text,

  -- Customer-facing notes
  customer_notes text,
  internal_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_id_idx on public.orders(customer_id);
create index orders_assigned_craftsman_id_idx on public.orders(assigned_craftsman_id);
create index orders_status_idx on public.orders(status);
create index orders_shopify_order_id_idx on public.orders(shopify_order_id);

alter table public.orders enable row level security;

-- Customer can see their own orders.
-- Craftsman can see orders assigned to them.
-- Admin can see all.
create policy "orders_select_visible" on public.orders
  for select using (
    auth.uid() = customer_id
    or auth.uid() = assigned_craftsman_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Customer can create own orders (as draft).
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = customer_id);

-- Customer can update only their own draft orders.
-- Admin can update any.
-- Craftsman can update only assigned orders (status changes through app logic).
create policy "orders_update_visible" on public.orders
  for update using (
    (auth.uid() = customer_id and status = 'draft')
    or auth.uid() = assigned_craftsman_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- messages (per-order chat)
-- ----------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  attachments text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index messages_order_id_idx on public.messages(order_id, created_at);

alter table public.messages enable row level security;

-- Same visibility as the parent order.
create policy "messages_select_visible" on public.messages
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = messages.order_id
        and (
          auth.uid() = o.customer_id
          or auth.uid() = o.assigned_craftsman_id
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
          )
        )
    )
  );

-- Sender must be visible to the order, and must be themselves.
create policy "messages_insert_as_self" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.orders o
      where o.id = messages.order_id
        and (
          auth.uid() = o.customer_id
          or auth.uid() = o.assigned_craftsman_id
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- order_events (audit log)
-- ----------------------------------------------------------------------------
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events(order_id, created_at);

alter table public.order_events enable row level security;

create policy "order_events_select_visible" on public.order_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and (
          auth.uid() = o.customer_id
          or auth.uid() = o.assigned_craftsman_id
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- Auto-create profile when a new auth.users row is inserted
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_craftsmen_updated_at
  before update on public.craftsmen
  for each row execute function public.set_updated_at();

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Realtime: enable for messages and orders so chat & status updates push
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.orders;
