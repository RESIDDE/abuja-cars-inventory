-- ============================================================================
-- A signature from the person taking the vehicle out (or handing it back).
--
-- The image lives in a private bucket; the event stores only its path. Like
-- the keys count, this exists to settle a later dispute, so it is written in
-- the same transaction as the movement itself.
-- ============================================================================

alter table public.vi_vehicle_events
  add column if not exists signature_path text;

comment on column public.vi_vehicle_events.signature_path is
  'Path in the movement-signatures bucket. Null when nobody signed.';

-- ----------------------------------------------------------------------------
-- Bucket. Private: a signature is a person''s mark, not public artwork.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('movement-signatures', 'movement-signatures', false, 2097152, array['image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vi_signatures_staff_select" on storage.objects;
create policy "vi_signatures_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'movement-signatures' and public.vi_is_staff());

drop policy if exists "vi_signatures_staff_insert" on storage.objects;
create policy "vi_signatures_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'movement-signatures' and public.vi_is_staff());

-- Deliberately no update or delete policy. A signature is evidence: once it is
-- attached to a movement it should not be swapped or quietly removed. Deleting
-- the vehicle still clears it, via the storage objects going with the bucket
-- prefix in a deliberate cleanup.

-- ----------------------------------------------------------------------------
-- Movement function gains the signature
-- ----------------------------------------------------------------------------
drop function if exists public.vi_record_movement(uuid, text, timestamptz, text, text, text, integer);

create or replace function public.vi_record_movement(
  p_vehicle_id     uuid,
  p_event_type     text,
  p_occurred_at    timestamptz default now(),
  p_staff_name     text default null,
  p_recipient_name text default null,
  p_notes          text default null,
  p_keys_count     integer default null,
  p_signature_path text default null
)
returns public.vi_vehicle_events
language plpgsql
security invoker
as $$
declare
  v_event         public.vi_vehicle_events;
  v_occurred_at   timestamptz := coalesce(p_occurred_at, now());
  v_status        text;
  v_released_date date;
begin
  if p_event_type not in ('checked_in', 'released') then
    raise exception 'Invalid event type: %', p_event_type using errcode = '22023';
  end if;

  if p_keys_count is not null and p_keys_count < 0 then
    raise exception 'Keys cannot be negative: %', p_keys_count using errcode = '22023';
  end if;

  if p_event_type = 'released' then
    v_status := 'released';
    v_released_date := (v_occurred_at at time zone 'Africa/Lagos')::date;
  else
    v_status := 'in_stock';
    v_released_date := null;
  end if;

  update public.vi_vehicles
     set status        = v_status,
         released_date = v_released_date,
         keys_count    = case
                           when p_keys_count is null then keys_count
                           when p_event_type = 'released'
                             then greatest(0, keys_count - p_keys_count)
                           else keys_count + p_keys_count
                         end
   where id = p_vehicle_id;

  if not found then
    raise exception 'Vehicle % not found', p_vehicle_id using errcode = 'P0002';
  end if;

  insert into public.vi_vehicle_events (
    vehicle_id, event_type, occurred_at, staff_name, recipient_name, notes,
    keys_count, signature_path
  )
  values (
    p_vehicle_id,
    p_event_type,
    v_occurred_at,
    nullif(btrim(p_staff_name), ''),
    nullif(btrim(p_recipient_name), ''),
    nullif(btrim(p_notes), ''),
    p_keys_count,
    nullif(btrim(p_signature_path), '')
  )
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.vi_record_movement(
  uuid, text, timestamptz, text, text, text, integer, text
) to authenticated;
