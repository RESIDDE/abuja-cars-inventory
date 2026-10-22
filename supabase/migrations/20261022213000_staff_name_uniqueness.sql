-- ============================================================================
-- Tighten the staff-name uniqueness check.
--
-- The first version keyed on lower(btrim(name)), which collapses case and
-- surrounding spaces but leaves runs of space inside the name alone — so
-- "Bayo  Adeyemi" and "Bayo Adeyemi" were two different people as far as the
-- index was concerned. Caught by testing it rather than assuming it.
-- ============================================================================

-- Normalise what is already stored, so the stricter index can be built.
update public.vi_staff_members
   set name = regexp_replace(btrim(name), '\s+', ' ', 'g')
 where name <> regexp_replace(btrim(name), '\s+', ' ', 'g');

-- Should normalising have collided two rows, keep the one recorded first.
delete from public.vi_staff_members a
 using public.vi_staff_members b
 where lower(a.name) = lower(b.name)
   and a.created_at > b.created_at;

drop index if exists public.vi_staff_members_name_unique;

create unique index vi_staff_members_name_unique
  on public.vi_staff_members (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
