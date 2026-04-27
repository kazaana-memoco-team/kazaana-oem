-- ============================================================================
-- Documents (見積書 / 請求書 / 領収書)
-- ----------------------------------------------------------------------------
-- Each document is tied to an order. Issuing is admin-only. Both customer
-- and admin can view documents for orders they have access to.
-- ============================================================================

do $$ begin
  create type document_type as enum ('quote', 'invoice', 'receipt');
exception when duplicate_object then null; end $$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type document_type not null,
  /** Human-readable identifier shown on the document, e.g. Q-202604-0001 */
  document_number text not null,
  /** Total amount the document represents (yen, integer) */
  amount integer,
  /** Free-form admin note shown on the document body */
  notes text,
  issued_by uuid references public.profiles(id) on delete set null,
  /** Snapshot of order/customization at issue time + per-doc fields */
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists documents_number_unique
  on public.documents(document_number);
create index if not exists documents_order_id_idx
  on public.documents(order_id, created_at);
create index if not exists documents_type_created_at_idx
  on public.documents(type, created_at);

alter table public.documents enable row level security;

drop policy if exists "documents_select_visible" on public.documents;
create policy "documents_select_visible" on public.documents
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = documents.order_id
        and (
          auth.uid() = o.customer_id
          or auth.uid() = o.assigned_craftsman_id
          or public.current_user_role() = 'admin'
        )
    )
  );

drop policy if exists "documents_insert_admin" on public.documents;
create policy "documents_insert_admin" on public.documents
  for insert with check (public.current_user_role() = 'admin');

drop policy if exists "documents_delete_admin" on public.documents;
create policy "documents_delete_admin" on public.documents
  for delete using (public.current_user_role() = 'admin');
