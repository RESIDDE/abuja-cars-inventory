-- ============================================================================
-- At most five pictures per vehicle.
--
-- Enforced here as well as in the browser: the browser check stops somebody
-- picking a sixth, this stops anything else writing one. Same reasoning as the
-- bucket's own size and mime-type limits.
--
-- Any row already over the limit would block the constraint, so it is trimmed
-- first — keeping the earliest five, which are the ones taken at intake.
-- ============================================================================

update public.vi_vehicles
   set photos = (
         select coalesce(jsonb_agg(photo), '[]'::jsonb)
           from (
             select photo
               from jsonb_array_elements(photos) with ordinality as t(photo, position)
              order by position
              limit 5
           ) kept
       )
 where jsonb_array_length(photos) > 5;

alter table public.vi_vehicles drop constraint if exists vi_vehicles_photos_max_check;
alter table public.vi_vehicles
  add constraint vi_vehicles_photos_max_check
  check (jsonb_array_length(photos) <= 5);
