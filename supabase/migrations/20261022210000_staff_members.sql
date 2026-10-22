-- ============================================================================
-- Staff members — the people who physically handle vehicles.
--
-- Deliberately NOT vi_staff. That table is the login allowlist and every row
-- must point at an auth.users account. A yard hand who hands back a car may
-- never sign in to anything, but still needs to be named on the movement, so
-- these are just names.
-- ============================================================================

create table if not exists public.vi_staff_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  phone       text,
  -- Kept rather than deleted when someone leaves, so old movements still make
  -- sense; inactive names simply drop out of the dropdown.
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per person, however the name is cased or spaced.
create unique index if not exists vi_staff_members_name_unique
  on public.vi_staff_members (lower(btrim(name)));

create index if not exists vi_staff_members_active_idx
  on public.vi_staff_members (active);

drop trigger if exists vi_staff_members_set_updated_at on public.vi_staff_members;
create trigger vi_staff_members_set_updated_at
  before update on public.vi_staff_members
  for each row execute function public.update_updated_at();

alter table public.vi_staff_members enable row level security;

drop policy if exists "vi_staff_members_staff_all" on public.vi_staff_members;
create policy "vi_staff_members_staff_all" on public.vi_staff_members
  for all to authenticated
  using (public.vi_is_staff()) with check (public.vi_is_staff());
