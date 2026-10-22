-- ============================================================================
-- One-time bootstrap: make the existing account(s) staff.
--
-- The staff lock has a chicken-and-egg problem — nobody can use the app until
-- somebody is on the list, and the list cannot be edited from the app by
-- design. This seeds it with whoever has already confirmed an account on this
-- project, which on a freshly created project is the owner.
--
-- It runs once. Later staff are added deliberately, with a new migration or a
-- statement in the SQL editor:
--
--   insert into public.vi_staff (user_id, full_name)
--   select id, 'Their name' from auth.users where email = 'them@example.com'
--   on conflict (user_id) do nothing;
-- ============================================================================

insert into public.vi_staff (user_id, full_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
where u.email_confirmed_at is not null
on conflict (user_id) do nothing;

do $$
declare
  n integer;
begin
  select count(*) into n from public.vi_staff;
  raise notice 'vi_staff now has % row(s)', n;
  if n = 0 then
    raise warning 'No confirmed accounts found — nobody can use the app until a staff row exists.';
  end if;
end;
$$;
