-- Several practice areas on one mandate (Khyati's feedback): a role can be "TMT and data privacy"
-- or "GC and M&A". practice_areas holds all of them, in the order picked. practice_area stays as
-- the first one, so imports, older code and the board keep working; a trigger keeps the two in
-- step. Every area must be on the practice_areas list (never free text).
-- Re-engagement now counts a candidate as a practice fit on any of the mandate's areas.

alter table mandates add column practice_areas text[] not null default '{}';
update mandates set practice_areas = array[practice_area] where practice_area is not null;
create index mandates_practice_areas_idx on mandates using gin (practice_areas);

create function mandate_practice_sync() returns trigger
language plpgsql set search_path = public as $$
declare
  v_bad text;
  v_old text[] := '{}';
begin
  if tg_op = 'UPDATE' then v_old := old.practice_areas; end if;
  if tg_op = 'INSERT' then
    -- A replacement mandate (opened by placement_after) copies the areas of the one it replaces.
    if cardinality(new.practice_areas) = 0 and new.replaces_placement_id is not null then
      select m.practice_areas into new.practice_areas
      from placements p join mandates m on m.id = p.mandate_id
      where p.id = new.replaces_placement_id;
      new.practice_areas := coalesce(new.practice_areas, '{}');
    end if;
    if cardinality(new.practice_areas) = 0 and new.practice_area is not null then
      new.practice_areas := array[new.practice_area];
    end if;
  elsif new.practice_areas is not distinct from old.practice_areas
        and new.practice_area is distinct from old.practice_area then
    -- Only the single field was set (an import, older code): the list becomes just that.
    new.practice_areas := case when new.practice_area is null then '{}' else array[new.practice_area] end;
  end if;

  -- Tidy: no blanks, no repeats, order kept.
  new.practice_areas := coalesce((
    select array_agg(x order by n)
    from (select distinct on (x) x, n
          from unnest(new.practice_areas) with ordinality u (x, n)
          where nullif(trim(x), '') is not null
          order by x, n) d), '{}');

  -- Newly added areas must be on the list. (Areas already on the mandate are left alone.)
  select x into v_bad from unnest(new.practice_areas) x
  where not x = any (v_old) and not exists (select 1 from practice_areas p where p.name = x) limit 1;
  if v_bad is not null then
    raise exception 'Unknown practice area: %', v_bad using hint = 'Pick it from the list, or add it in Settings first.';
  end if;

  new.practice_area := new.practice_areas[1];
  return new;
end $$;

create trigger mandates_practice_sync before insert or update on mandates
  for each row execute function mandate_practice_sync();

-- Re-engagement v2: the practice fit is the first of the mandate's areas the candidate has
-- (on their profile, else in what they asked for). Everything else is as before.
create or replace function match_candidates_for_mandate(p_mandate uuid, p_limit int default 50)
returns table (candidate_id uuid, full_name text, score int, reasons text[], pqe_today numeric,
               last_recruiter_id uuid, last_called_at timestamptz)
language sql stable set search_path = public as $$
  with m as (
    select m.*, cl.firm_id as client_firm_id, f.name as client_firm_name
    from mandates m join clients cl on cl.id = m.client_id join firms f on f.id = cl.firm_id
    where m.id = p_mandate
  ),
  scored as materialized (
    select c.id, c.full_name, c.owner_id, pqe_years(c.practice_start_date) as pqe,
      exists (select 1 from interest_tags t
              where t.candidate_id = c.id and t.firm_id = m.client_firm_id
                and (t.city is null or m.city is null or lower(t.city) = lower(m.city))) as wants_firm,
      (m.city is not null and (lower(coalesce(c.current_city, '')) = lower(m.city)
         or exists (select 1 from unnest(c.preferred_cities) x where lower(x) = lower(m.city))
         or exists (select 1 from interest_tags t where t.candidate_id = c.id and lower(t.city) = lower(m.city)))) as city_fit,
      coalesce(
        (select u.x from unnest(m.practice_areas) with ordinality u (x, n) where u.x = any (c.practice_areas) order by u.n limit 1),
        (select t.practice_area from interest_tags t where t.candidate_id = c.id and t.practice_area = any (m.practice_areas) limit 1)
      ) as m_practice,
      m.pqe_min, m.pqe_max, m.client_firm_name, m.city as m_city, m.client_id
    from candidates c cross join m
    where c.deletion_requested_at is null
      and c.current_firm_id is distinct from m.client_firm_id
      and not exists (select 1 from pipeline_entries pe where pe.candidate_id = c.id and pe.mandate_id = m.id)
  ),
  fit as (
    select s.*,
      (s.m_practice is not null) as practice_fit,
      (s.pqe is not null and (s.pqe_min is not null or s.pqe_max is not null)
        and (s.pqe_min is null or s.pqe >= s.pqe_min - 0.5)
        and (s.pqe_max is null or s.pqe <= s.pqe_max + 0.5)) as pqe_fit,
      (s.pqe is not null and ((s.pqe_min is not null and s.pqe < s.pqe_min - 1.5)
        or (s.pqe_max is not null and s.pqe > s.pqe_max + 1.5))) as pqe_far
    from scored s
  )
  select f.id, f.full_name,
    (case when f.wants_firm then 5 else 0 end + case when f.practice_fit then 2 else 0 end
     + case when f.pqe_fit then 2 else 0 end + case when f.city_fit then 1 else 0 end)::int as score,
    array_remove(array[
      case when f.wants_firm   then 'Asked for ' || f.client_firm_name end,
      case when f.practice_fit then 'Practice: ' || f.m_practice end,
      case when f.pqe_fit      then 'PQE ' || f.pqe || ' today' end,
      case when f.city_fit     then 'City: ' || f.m_city end], null) as reasons,
    f.pqe,
    coalesce(lc.recruiter_id, f.owner_id),
    lc.called_at
  from fit f
  left join lateral (
    select sc.recruiter_id, sc.called_at from screening_calls sc
    where sc.candidate_id = f.id and sc.status = 'done'
    order by sc.called_at desc nulls last limit 1
  ) lc on true
  where (f.wants_firm or (f.practice_fit and f.pqe_fit and f.city_fit))
    and not f.pqe_far
    and not exists (select 1 from check_duplicate(f.id, f.client_id) d where d.blocking)
  order by score desc, lc.called_at desc nulls last
  limit p_limit
$$;

-- The board lists every area (new column at the end; the rest unchanged).
create or replace view v_mandate_board with (security_invoker = on) as
select m.id, m.title, m.status, m.client_id, cl.display_name as client, m.city, m.practice_area,
  m.pqe_min, m.pqe_max, m.grade_label, m.owner_id, m.received_on, m.last_activity_at,
  today_ist() - m.received_on as days_open,
  (m.status = 'active' and working_days_between((m.last_activity_at at time zone 'Asia/Kolkata')::date, today_ist())
     >= s.stale_after_working_days) as is_stale,
  count(pe.id) filter (where pe.exited_at is null)        as in_play,
  count(pe.id) filter (where pe.stage >= 'cv_shared')     as cvs_shared,
  count(pe.id) filter (where pe.stage >= 'interview')     as interviewed,
  count(pe.id) filter (where pe.stage = 'joined')         as joined,
  m.practice_areas
from mandates m
join clients cl on cl.id = m.client_id
cross join settings s
left join pipeline_entries pe on pe.mandate_id = m.id
group by m.id, cl.display_name, s.stale_after_working_days;
