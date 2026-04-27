-- ============================================================================
-- Add sender_context to messages
-- ----------------------------------------------------------------------------
-- Distinguishes messages by the page they were sent from, not by sender role.
-- This makes the chat work correctly for testing with a single account that
-- holds multiple roles, and is more accurate semantically:
--   "this message was posted as a customer reply" vs "as a BECOS reply"
-- regardless of who actually clicked send.
-- ============================================================================

do $$ begin
  create type message_sender_context as enum ('customer', 'admin');
exception when duplicate_object then null; end $$;

alter table public.messages
  add column if not exists sender_context message_sender_context
    not null default 'customer';
