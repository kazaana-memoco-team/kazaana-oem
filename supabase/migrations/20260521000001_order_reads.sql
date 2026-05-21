-- ============================================================================
-- Per-user "last read" tracking for order chat (unread badges)
-- ============================================================================

create table if not exists public.order_reads (
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (order_id, user_id)
);

alter table public.order_reads enable row level security;

-- Users manage only their own read markers.
drop policy if exists "order_reads_select_own" on public.order_reads;
create policy "order_reads_select_own" on public.order_reads
  for select using (auth.uid() = user_id);

drop policy if exists "order_reads_insert_own" on public.order_reads;
create policy "order_reads_insert_own" on public.order_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "order_reads_update_own" on public.order_reads;
create policy "order_reads_update_own" on public.order_reads
  for update using (auth.uid() = user_id);
