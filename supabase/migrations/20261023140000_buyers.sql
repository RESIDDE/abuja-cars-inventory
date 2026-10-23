-- ============================================================================
-- Who bought the vehicle.
--
-- A buyer is a customer record in vi_owners, not a separate kind of person:
-- the same individual may store a car with you and buy another one, and they
-- have one name and one phone number either way. Matching them on phone then
-- works across both relationships.
--
-- ON DELETE SET NULL, deliberately — unlike owner_id, which cascades. Removing
-- a customer must never delete a vehicle somebody bought; it should only forget
-- who bought it. buyer_name is kept alongside so the sale still reads sensibly
-- if that happens, or if a sale is recorded without a full customer record.
-- ============================================================================

alter table public.vi_vehicles
  add column if not exists buyer_id uuid references public.vi_owners(id) on delete set null;

create index if not exists vi_vehicles_buyer_id_idx on public.vi_vehicles (buyer_id);

comment on column public.vi_vehicles.buyer_id is
  'Customer who bought it, in vi_owners. Null when the sale recorded only a name.';

drop function if exists public.vi_record_movement(uuid, text, timestamptz, text, text, text, integer, text, numeric);

create or replace function public.vi_record_movement(
  p_vehicle_id     uuid,
  p_event_type     text,
  p_occurred_at    timestamptz default now(),
  p_staff_name     text default null,
  p_recipient_name text default null,
  p_notes          text default null,
  p_keys_count     integer default null,
  p_signature_path text default null,
  p_sale_price     numeric default null,
  p_buyer_id       uuid default null
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
                              then coalesce(p_sale_price, sale_price) else sale_price end,
         buyer_name    = case when p_event_type = 'sold'
                              then coalesce(nullif(btrim(p_recipient_name), ''), buyer_name)
                              else buyer_name end,
         buyer_id      = case when p_event_type = 'sold'
                              then coalesce(p_buyer_id, buyer_id) else buyer_id end,
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
  uuid, text, timestamptz, text, text, text, integer, text, numeric, uuid
) to authenticated;
