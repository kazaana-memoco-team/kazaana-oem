-- ============================================================================
-- Admin-mediated chat model
-- ----------------------------------------------------------------------------
-- BECOS admin acts as the intermediary between customer and craftsman.
-- - Customer: send + read on their own orders
-- - Admin:    send + read on any order
-- - Craftsman: read only on assigned orders (NO message insert)
-- ============================================================================

drop policy if exists "messages_insert_as_self" on public.messages;

create policy "messages_insert_as_self" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.orders o
      where o.id = messages.order_id
        and (
          auth.uid() = o.customer_id
          or public.current_user_role() = 'admin'
        )
    )
  );

-- (messages_select_visible already allows customer / craftsman / admin to read.
-- We leave that as-is so craftsmen can see what the customer requested.)
