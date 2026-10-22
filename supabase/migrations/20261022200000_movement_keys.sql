-- ============================================================================
-- How many keys changed hands on a movement.
--
-- "We gave them two keys, they brought one back" is exactly the sort of thing
-- that gets disputed months later, so the number is recorded per movement and
-- the vehicle's own count is adjusted to match what the yard actually holds.
-- ============================================================================

alter table public.vi_vehicle_events
  add column if not exists keys_count integer
    check (keys_count is null or keys_count >= 0);

comment on column public.vi_vehicle_events.keys_count is
  'Keys handed over on a release, or brought back on a check-in. Null when not recorded.';

-- The signature changes, so the old overload has to go first — leaving both
-- would make the PostgREST call ambiguous.
drop function if exists public.vi_record_movement(uuid, text, timestamptz, text, text, text);

create or replace function public.vi_record_movement(
  p_vehicle_id     uuid,
  p_event_type     text,
  p_occurred_at    timestamptz default now(),
  p_staff_name     text default null,
  p_recipient_name text default null,
  p_notes          text default null,
  p_keys_count     integer default null
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
    raise exception 'Invalid event type: %', p_event_type
      using errcode = '22023';
  end if;

  if p_keys_count is not null and p_keys_count < 0 then
    raise exception 'Keys cannot be negative: %', p_keys_count
      using errcode = '22023';
  end if;

  if p_event_type = 'released' then
    v_status := 'released';
    -- The calendar date as the yard experiences it, not UTC.
    v_released_date := (v_occurred_at at time zone 'Africa/Lagos')::date;
  else
    v_status := 'in_stock';
    v_released_date := null;
  end if;

  update public.vi_vehicles
     set status        = v_status,
         released_date = v_released_date,
         -- Null means "not recorded", which must leave the count alone. It is
         -- also what the opening check-in passes, so intake does not double up
         -- on the keys the form already recorded.
         keys_count    = case
                           when p_keys_count is null then keys_count
                           when p_event_type = 'released'
                             then greatest(0, keys_count - p_keys_count)
                           else keys_count + p_keys_count
                         end
   where id = p_vehicle_id;

  if not found then
    raise exception 'Vehicle % not found', p_vehicle_id
      using errcode = 'P0002';
  end if;

  insert into public.vi_vehicle_events (
    vehicle_id, event_type, occurred_at, staff_name, recipient_name, notes, keys_count
  )
  values (
    p_vehicle_id,
    p_event_type,
    v_occurred_at,
    nullif(btrim(p_staff_name), ''),
    nullif(btrim(p_recipient_name), ''),
    nullif(btrim(p_notes), ''),
    p_keys_count
  )
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.vi_record_movement(
  uuid, text, timestamptz, text, text, text, integer
) to authenticated;
