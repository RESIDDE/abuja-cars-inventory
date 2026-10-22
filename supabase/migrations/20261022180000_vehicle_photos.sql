-- ============================================================================
-- Photos of the vehicle itself.
--
-- The browser converts every picture to WebP before upload, so the bucket only
-- ever accepts image/webp. The 5 MB ceiling is enforced here as well as in the
-- browser: a client-side check is a convenience, not a control.
--
-- The bucket is PRIVATE. These are photographs of customers' cars, often with
-- plates visible, so they are served through short-lived signed URLs rather
-- than a public path anyone could guess or share.
-- ============================================================================

alter table public.vi_vehicles
  add column if not exists photos jsonb not null default '[]'::jsonb;

comment on column public.vi_vehicles.photos is
  'Array of { path, bytes, width, height } objects in the vehicle-photos bucket.';

-- ----------------------------------------------------------------------------
-- Bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', false, 5242880, array['image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Only staff may touch them — same rule as every other table here.
-- ----------------------------------------------------------------------------
drop policy if exists "vi_vehicle_photos_staff_select" on storage.objects;
create policy "vi_vehicle_photos_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'vehicle-photos' and public.vi_is_staff());

drop policy if exists "vi_vehicle_photos_staff_insert" on storage.objects;
create policy "vi_vehicle_photos_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and public.vi_is_staff());

drop policy if exists "vi_vehicle_photos_staff_update" on storage.objects;
create policy "vi_vehicle_photos_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-photos' and public.vi_is_staff())
  with check (bucket_id = 'vehicle-photos' and public.vi_is_staff());

drop policy if exists "vi_vehicle_photos_staff_delete" on storage.objects;
create policy "vi_vehicle_photos_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-photos' and public.vi_is_staff());
