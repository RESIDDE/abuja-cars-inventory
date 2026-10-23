-- ============================================================================
-- Condition, mileage, where it is registered, interior — and selling.
--
-- "Sold" is a third state, not a flag: a sold vehicle has left the yard like a
-- released one, but ownership and money changed hands too. It therefore needs
-- the status constraint, the event type and vi_record_movement extended in
-- step, or a sale could be recorded with no corresponding movement.
-- ============================================================================

alter table public.vi_vehicles
  add column if not exists condition     text,
  add column if not exists mileage       integer,
  add column if not exists mileage_unit  text not null default 'km',
  add column if not exists registration  text,
  add column if not exists interior      text,
  add column if not exists sold_date     date,
  add column if not exists sale_price    numeric(12,2),
  add column if not exists buyer_name    text;

comment on column public.vi_vehicles.mileage_unit is
  'km or mi. Worth recording: a US import reads miles, a European one km, and 100,000 of each is a very different car.';
comment on column public.vi_vehicles.registration is
  'nigeria = registered here; foreign = registered abroad or not yet registered.';

-- Constraints are added separately so a re-run does not trip over them.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vi_vehicles_condition_check') then
    alter table public.vi_vehicles
      add constraint vi_vehicles_condition_check
      check (condition is null or condition in ('new', 'used'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vi_vehicles_mileage_check') then
    alter table public.vi_vehicles
      add constraint vi_vehicles_mileage_check
      check (mileage is null or mileage >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vi_vehicles_mileage_unit_check') then
    alter table public.vi_vehicles
      add constraint vi_vehicles_mileage_unit_check
      check (mileage_unit in ('km', 'mi'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vi_vehicles_registration_check') then
    alter table public.vi_vehicles
      add constraint vi_vehicles_registration_check
      check (registration is null or registration in ('nigeria', 'foreign'));
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 'sold' joins the allowed statuses and event types
-- ----------------------------------------------------------------------------
alter table public.vi_vehicles drop constraint if exists vi_vehicles_status_check;
alter table public.vi_vehicles
  add constraint vi_vehicles_status_check
  check (status in ('in_stock', 'released', 'sold'));

alter table public.vi_vehicle_events drop constraint if exists vi_vehicle_events_event_type_check;
alter table public.vi_vehicle_events
  add constraint vi_vehicle_events_event_type_check
  check (event_type in ('checked_in', 'released', 'sold'));

create index if not exists vi_vehicles_sold_date_idx on public.vi_vehicles (sold_date);

-- ----------------------------------------------------------------------------
-- The movement function learns to sell
-- ----------------------------------------------------------------------------
drop function if exists public.vi_record_movement(uuid, text, timestamptz, text, text, text, integer, text);

create or replace function public.vi_record_movement(
  p_vehicle_id     uuid,
  p_event_type     text,
  p_occurred_at    timestamptz default now(),
  p_staff_name     text default null,
  p_recipient_name text default null,
  p_notes          text default null,
  p_keys_count     integer default null,
  p_signature_path text default null,
  p_sale_price     numeric default null
)
returns public.vi_vehicle_events
language plpgsql
security invoker
as $$
declare
  v_event         public.vi_vehicle_events;
  v_occurred_at   timestamptz := coalesce(p_occurred_at, now());
  v_local_date    date;
  v_status        text;
  v_released_date date;
  v_sold_date     date;
begin
  if p_event_type not in ('checked_in', 'released', 'sold') then
    raise exception 'Invalid event type: %', p_event_type using errcode = '22023';
  end if;

  if p_keys_count is not null and p_keys_count < 0 then
    raise exception 'Keys cannot be negative: %', p_keys_count using errcode = '22023';
  end if;

  if p_sale_price is not null and p_sale_price < 0 then
    raise exception 'Sale price cannot be negative: %', p_sale_price using errcode = '22023';
  end if;

  -- The calendar date as the yard experiences it, not UTC.
  v_local_date := (v_occurred_at at time zone 'Africa/Lagos')::date;

  if p_event_type = 'released' then
    v_status := 'released';
    v_released_date := v_local_date;
    v_sold_date := null;
  elsif p_event_type = 'sold' then
    v_status := 'sold';
    -- A sold vehicle has also left the yard, so released_date is set too and
    -- the "still held" figures stay correct without special-casing sales.
    v_released_date := v_local_date;
    v_sold_date := v_local_date;
  else
    v_status := 'in_stock';
    v_released_date := null;
    v_sold_date := null;
  end if;

  update public.vi_vehicles
     set status        = v_status,
         released_date = v_released_date,
         sold_date     = v_sold_date,
         sale_price    = case when p_event_type = 'sold'
                              then coalesce(p_sale_price, sale_price)
                              else sale_price end,
         buyer_name    = case when p_event_type = 'sold'
                              then coalesce(nullif(btrim(p_recipient_name), ''), buyer_name)
                              else buyer_name end,
         keys_count    = case
                           when p_keys_count is null then keys_count
                           when p_event_type = 'checked_in' then keys_count + p_keys_count
                           else greatest(0, keys_count - p_keys_count)
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
    p_vehicle_id, p_event_type, v_occurred_at,
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
  uuid, text, timestamptz, text, text, text, integer, text, numeric
) to authenticated;
