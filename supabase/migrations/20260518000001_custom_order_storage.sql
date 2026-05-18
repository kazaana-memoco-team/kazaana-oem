-- ============================================================================
-- Storage bucket for full-custom-order reference images
-- ----------------------------------------------------------------------------
-- Customers upload reference images when requesting a fully custom piece.
-- Bucket is public-read (URLs contain unguessable UUIDs); only authenticated
-- users can upload.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('reference-images', 'reference-images', true)
on conflict (id) do nothing;

drop policy if exists "reference_images_authenticated_upload" on storage.objects;
create policy "reference_images_authenticated_upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'reference-images');

drop policy if exists "reference_images_public_read" on storage.objects;
create policy "reference_images_public_read"
  on storage.objects for select
  using (bucket_id = 'reference-images');

drop policy if exists "reference_images_owner_delete" on storage.objects;
create policy "reference_images_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'reference-images' and owner = auth.uid());
