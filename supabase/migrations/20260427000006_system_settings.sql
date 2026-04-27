-- ============================================================================
-- System settings (key/value JSON store, admin-only)
-- ----------------------------------------------------------------------------
-- Used for editable templates (email body, subject, etc.) without redeploys.
-- ============================================================================

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.system_settings enable row level security;

drop policy if exists "system_settings_select_admin" on public.system_settings;
create policy "system_settings_select_admin" on public.system_settings
  for select using (public.current_user_role() = 'admin');

drop policy if exists "system_settings_modify_admin" on public.system_settings;
create policy "system_settings_modify_admin" on public.system_settings
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- updated_at maintenance
drop trigger if exists trg_system_settings_updated_at on public.system_settings;
create trigger trg_system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();
