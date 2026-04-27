-- ============================================================================
-- Allow sender (or admin) to delete their own messages.
-- ============================================================================

drop policy if exists "messages_delete_own_or_admin" on public.messages;

create policy "messages_delete_own_or_admin" on public.messages
  for delete using (
    auth.uid() = sender_id
    or public.current_user_role() = 'admin'
  );

-- Realtime: DELETE events must be broadcast for the chat UI to remove
-- messages in real time. The publication already includes `messages`
-- (added in the initial schema), but ensure DELETE is allowed.
alter table public.messages replica identity full;
