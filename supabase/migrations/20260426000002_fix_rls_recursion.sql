-- ============================================================================
-- Fix infinite recursion in RLS policies that reference profiles.role
-- ============================================================================
-- Problem: policies on `profiles` (and policies on other tables that check
-- for admin role) query `profiles` to check role → triggers the same
-- policy → infinite recursion.
--
-- Fix: introduce a SECURITY DEFINER helper that reads the caller's role
-- with RLS bypassed. Use it in policies instead of inline subqueries.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: get current user's role without triggering profile RLS
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Allow callers to invoke the helper (auth role is the default for app users)
grant execute on function public.current_user_role() to authenticated, anon;

-- ----------------------------------------------------------------------------
-- profiles: replace recursive policies
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (
    auth.uid() = id
    or public.current_user_role() = 'admin'
  );

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- craftsmen: replace recursive policies
-- ----------------------------------------------------------------------------
drop policy if exists "craftsmen_select_active" on public.craftsmen;
drop policy if exists "craftsmen_update_own" on public.craftsmen;

create policy "craftsmen_select_active" on public.craftsmen
  for select using (
    is_active = true
    or auth.uid() = profile_id
    or public.current_user_role() = 'admin'
  );

create policy "craftsmen_update_own" on public.craftsmen
  for update using (auth.uid() = profile_id);

-- ----------------------------------------------------------------------------
-- orders: replace recursive policies
-- ----------------------------------------------------------------------------
drop policy if exists "orders_select_visible" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_visible" on public.orders;

create policy "orders_select_visible" on public.orders
  for select using (
    auth.uid() = customer_id
    or auth.uid() = assigned_craftsman_id
    or public.current_user_role() = 'admin'
  );

create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = customer_id);

create policy "orders_update_visible" on public.orders
  for update using (
    (auth.uid() = customer_id and status = 'draft')
    or auth.uid() = assigned_craftsman_id
    or public.current_user_role() = 'admin'
  );

-- ----------------------------------------------------------------------------
-- messages: replace recursive policies
-- ----------------------------------------------------------------------------
drop policy if exists "messages_select_visible" on public.messages;
drop policy if exists "messages_insert_as_self" on public.messages;

create policy "messages_select_visible" on public.messages
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = messages.order_id
        and (
          auth.uid() = o.customer_id
          or auth.uid() = o.assigned_craftsman_id
          or public.current_user_role() = 'admin'
        )
    )
  );

create policy "messages_insert_as_self" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.orders o
      where o.id = messages.order_id
        and (
          auth.uid() = o.customer_id
          or auth.uid() = o.assigned_craftsman_id
          or public.current_user_role() = 'admin'
        )
    )
  );

-- ----------------------------------------------------------------------------
-- order_events: replace recursive policies
-- ----------------------------------------------------------------------------
drop policy if exists "order_events_select_visible" on public.order_events;

create policy "order_events_select_visible" on public.order_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and (
          auth.uid() = o.customer_id
          or auth.uid() = o.assigned_craftsman_id
          or public.current_user_role() = 'admin'
        )
    )
  );
