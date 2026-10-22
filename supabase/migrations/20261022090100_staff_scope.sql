-- ============================================================================
-- Scope access to AbujaCar staff, not to "anyone with an account".
--
-- WHY THIS EXISTS
-- The 0001 policies said `to authenticated using (true)`. On a project used by
-- only this app that is fine. On a project SHARED WITH ANOTHER APPLICATION it
-- is not: Supabase auth is per-project, so anyone who signs up through the
-- other app receives a JWT with the role `authenticated` on this same project,
-- and that JWT satisfies `using (true)`. They could read every owner's name,
-- phone number and address, and delete vehicle records.
--
-- This replaces that blanket grant with an explicit allowlist.
--
-- ⚠ READ BEFORE RUNNING ⚠
-- The moment this is applied, nobody can see anything until they are listed in
-- vi_staff. Add yourself in the SAME SQL editor session, using the statement at
-- the bottom of this file, or you will lock yourself out of your own data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Who is allowed to work in this app
-- ----------------------------------------------------------------------------
create table if not exists public.vi_staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  added_at   timestamptz not null default now()
);

alter table public.vi_staff enable row level security;

-- SECURITY DEFINER is load-bearing. The policies below call this function, and
-- it reads vi_staff — which itself has RLS. Without DEFINER, checking the
-- policy on vi_staff would call this function, which would check the policy on
-- vi_staff, and Postgres would error on infinite recursion. DEFINER runs the
-- lookup with the owner's rights, bypassing RLS inside the function only.
create or replace function public.vi_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.vi_staff where user_id = auth.uid());
$$;

revoke all on function public.vi_is_staff() from public, anon;
grant execute on function public.vi_is_staff() to authenticated;

-- A signed-in person may see the roster only if they are on it.
drop policy if exists "vi_staff_read" on public.vi_staff;
create policy "vi_staff_read" on public.vi_staff
  for select to authenticated using (public.vi_is_staff());

-- Adding and removing staff is deliberately NOT possible from the app. Do it
-- in the SQL editor, so a compromised session cannot grant itself helpers.

-- ----------------------------------------------------------------------------
-- Replace the blanket policies
-- ----------------------------------------------------------------------------
drop policy if exists "vi_owners_authenticated_all" on public.vi_owners;
create policy "vi_owners_staff_all" on public.vi_owners
  for all to authenticated
  using (public.vi_is_staff()) with check (public.vi_is_staff());

drop policy if exists "vi_vehicles_authenticated_all" on public.vi_vehicles;
create policy "vi_vehicles_staff_all" on public.vi_vehicles
  for all to authenticated
  using (public.vi_is_staff()) with check (public.vi_is_staff());

drop policy if exists "vi_vehicle_events_authenticated_all" on public.vi_vehicle_events;
create policy "vi_vehicle_events_staff_all" on public.vi_vehicle_events
  for all to authenticated
  using (public.vi_is_staff()) with check (public.vi_is_staff());

-- ----------------------------------------------------------------------------
-- ⚠ RUN THIS TOO, IN THE SAME SESSION, WITH YOUR OWN EMAIL ⚠
-- ----------------------------------------------------------------------------
-- insert into public.vi_staff (user_id, full_name)
-- select id, 'Your name' from auth.users where email = 'you@example.com'
-- on conflict (user_id) do nothing;
--
-- Check it worked before closing the editor:
-- select u.email, s.full_name, s.added_at
--   from public.vi_staff s join auth.users u on u.id = s.user_id;
