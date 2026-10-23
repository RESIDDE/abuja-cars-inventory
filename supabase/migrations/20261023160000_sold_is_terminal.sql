-- ============================================================================
-- A sold vehicle has left for good.
--
-- Releasing or checking one back in made no sense and quietly corrupted the
-- record: checking back in reset the status to in_stock and cleared sold_date
-- while leaving sale_price and buyer_name behind, so the vehicle looked like
-- it was on the lot and sold at the same time.
--
-- Recording a sale again IS still allowed, so a wrong price or buyer can be
-- corrected; that leaves a second 'sold' event, which is an honest audit trail
-- of the correction.
-- ============================================================================

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
  v_event          public.vi_vehicle_events;
  v_occurred_at    timestamptz := coalesce(p_occurred_at, now());
  v_local_date     date;
  v_current_status text;
  v_status         text;
  v_released_date  date;
  v_sold_date      date;
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

  -- Locked for the rest of the transaction, so two people cannot both read
  -- "not sold yet" and then both write a movement.
  select status into v_current_status
    from public.vi_vehicles
   where id = p_vehicle_id
     for update;

  if not found then
    raise exception 'Vehicle % not found', p_vehicle_id using errcode = 'P0002';
  end if;

  if v_current_status = 'sold' and p_event_type <> 'sold' then
    raise exception 'This vehicle has been sold, so it cannot be released or checked back in'
      using errcode = '22023';
  end if;

  v_local_date := (v_occurred_at at time zone 'Africa/Lagos')::date;

  if p_event_type = 'released' then
    v_status := 'released';
    v_released_date := v_local_date;
    v_sold_date := null;
  elsif p_event_type = 'sold' then
    v_status := 'sold';
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
