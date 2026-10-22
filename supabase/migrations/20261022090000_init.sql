-- ============================================================================
-- AbujaCar Inventory — schema
--
-- Three tables: owners, the vehicles held on their behalf, and the movement
-- log. Run this once against your Supabase project (SQL Editor, or
-- `supabase db push`).
-- ============================================================================

-- gen_random_uuid() is built into Postgres core (13+), so no extension is
-- needed. uuid_generate_v4() would require uuid-ossp, which Supabase installs
-- into the `extensions` schema — not on the migration connection's search_path.

-- ----------------------------------------------------------------------------
-- Owners
-- ----------------------------------------------------------------------------
create table if not exists public.vi_owners (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  phone_primary    text not null,
  phone_secondary  text,
  email            text,
  address          text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Vehicles
-- ----------------------------------------------------------------------------
create table if not exists public.vi_vehicles (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.vi_owners(id) on delete cascade,
  make           text not null,                 -- "Car Type / Make" in the UI
  model          text not null,
  body_type      text,
  year           integer,
  vin            text,
  color          text,
  plate_number   text,
  keys_count     integer not null default 1 check (keys_count >= 0),
  -- The checklist of what the vehicle arrived with:
  -- [{ "item": "Spare tyre", "qty": 1, "note": "" }, ...]
  belongings     jsonb not null default '[]'::jsonb,
  price          numeric(12,2),                 -- NGN, nullable
  status         text not null default 'in_stock'
                   check (status in ('in_stock', 'released')),
  intake_date    date not null default current_date,
  released_date  date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists vi_vehicles_owner_id_idx on public.vi_vehicles (owner_id);
create index if not exists vi_vehicles_status_idx   on public.vi_vehicles (status);
create index if not exists vi_vehicles_vin_idx      on public.vi_vehicles (vin);

-- A VIN identifies one physical vehicle, so duplicates are blocked — but any
-- number of records may exist with no VIN recorded yet, hence the partial
-- index. Case-insensitive, because VINs get typed in either case.
create unique index if not exists vi_vehicles_vin_unique_idx
  on public.vi_vehicles (upper(vin))
  where vin is not null and vin <> '';

-- ----------------------------------------------------------------------------
-- Movement log
-- ----------------------------------------------------------------------------
create table if not exists public.vi_vehicle_events (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid not null references public.vi_vehicles(id) on delete cascade,
  event_type      text not null check (event_type in ('checked_in', 'released')),
  occurred_at     timestamptz not null default now(),
  staff_name      text,                         -- who handled it
  recipient_name  text,                         -- who took it / returned it
  notes           text,
  created_by      uuid default auth.uid() references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists vi_vehicle_events_vehicle_occurred_idx
  on public.vi_vehicle_events (vehicle_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vi_owners_set_updated_at on public.vi_owners;
create trigger vi_owners_set_updated_at
  before update on public.vi_owners
  for each row execute function public.update_updated_at();

drop trigger if exists vi_vehicles_set_updated_at on public.vi_vehicles;
create trigger vi_vehicles_set_updated_at
  before update on public.vi_vehicles
  for each row execute function public.update_updated_at();

-- ----------------------------------------------------------------------------
-- Row level security — any signed-in staff member has full access
-- ----------------------------------------------------------------------------
alter table public.vi_owners         enable row level security;
alter table public.vi_vehicles       enable row level security;
alter table public.vi_vehicle_events enable row level security;

drop policy if exists "vi_owners_authenticated_all" on public.vi_owners;
create policy "vi_owners_authenticated_all" on public.vi_owners
  for all to authenticated using (true) with check (true);

drop policy if exists "vi_vehicles_authenticated_all" on public.vi_vehicles;
create policy "vi_vehicles_authenticated_all" on public.vi_vehicles
  for all to authenticated using (true) with check (true);

drop policy if exists "vi_vehicle_events_authenticated_all" on public.vi_vehicle_events;
create policy "vi_vehicle_events_authenticated_all" on public.vi_vehicle_events
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- vi_record_movement — the only way custody should ever change.
--
-- Status change + log entry in ONE transaction. Doing these as two client
-- calls means a failure between them leaves a vehicle whose status changed
-- with nothing in its history to say so, which defeats the point of the log.
--
-- SECURITY INVOKER (the default, stated here for the record) so RLS still
-- applies to the caller.
-- ----------------------------------------------------------------------------
create or replace function public.vi_record_movement(
  p_vehicle_id     uuid,
  p_event_type     text,
  p_occurred_at    timestamptz default now(),
  p_staff_name     text default null,
  p_recipient_name text default null,
  p_notes          text default null
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
         released_date = v_released_date
   where id = p_vehicle_id;

  if not found then
    raise exception 'Vehicle % not found', p_vehicle_id
      using errcode = 'P0002';
  end if;

  insert into public.vi_vehicle_events (
    vehicle_id, event_type, occurred_at, staff_name, recipient_name, notes
  )
  values (
    p_vehicle_id,
    p_event_type,
    v_occurred_at,
    nullif(btrim(p_staff_name), ''),
    nullif(btrim(p_recipient_name), ''),
    nullif(btrim(p_notes), '')
  )
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.vi_record_movement(
  uuid, text, timestamptz, text, text, text
) to authenticated;
