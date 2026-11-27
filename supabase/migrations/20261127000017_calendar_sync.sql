-- Calendar sync, part 1 (Covaro → Google Calendar). Scheduled calls, interviews, follow-ups and
-- joinings go onto the Google Calendar of the person they belong to, once that person has connected
-- Google (migration 16). The app compares what should be there (v_calendar_feed) with what it put
-- there before (calendar_links) and adds, moves or removes events to match.
--
-- v_calendar_feed     every upcoming item, from yesterday to 120 days ahead, with whose calendar it
--                     goes on: calls → the recruiter; interviews and follow-ups → the pipeline owner;
--                     joinings → the owner of the candidate's pipeline entry for that mandate.
-- calendar_links      one row per item ever put on a calendar: which event, on whose calendar, and a
--                     fingerprint of what was written, so unchanged items cost nothing. Rows are never
--                     deleted; an event taken off a calendar is marked removed.
-- calendar_sync_state one row: who is syncing right now, so two open tabs don't sync at once.
-- calendar_sync       per person, on by default once connected; off takes Covaro's events back off.

alter table google_connections add column calendar_sync boolean not null default true;

create view v_calendar_feed with (security_invoker = true) as
select 'call'::text as kind, sc.id as item_id, sc.recruiter_id as member_id,
       sc.scheduled_for as starts_at, null::date as on_date,
       sc.candidate_id, c.full_name as candidate_name, m.title as mandate_title, cl.display_name as client_name,
       null::text as stage,
       (select p.phone from candidate_phones p where p.candidate_id = c.id order by p.is_primary desc, p.phone limit 1) as phone
from screening_calls sc
join candidates c on c.id = sc.candidate_id
left join mandates m on m.id = sc.mandate_id
left join clients cl on cl.id = m.client_id
where sc.status = 'scheduled'
  and sc.scheduled_for >= now() - interval '1 day' and sc.scheduled_for < now() + interval '120 days'
union all
select 'interview', pe.id, pe.owner_id, pe.interview_at, null,
       pe.candidate_id, c.full_name, m.title, cl.display_name, pe.stage::text, null
from pipeline_entries pe
join candidates c on c.id = pe.candidate_id
join mandates m on m.id = pe.mandate_id
join clients cl on cl.id = m.client_id
where pe.exit_reason is null and pe.interview_at is not null
  and pe.interview_at >= now() - interval '1 day' and pe.interview_at < now() + interval '120 days'
union all
select 'follow_up', pe.id, pe.owner_id, null, pe.follow_up_on,
       pe.candidate_id, c.full_name, m.title, cl.display_name, null, null
from pipeline_entries pe
join candidates c on c.id = pe.candidate_id
join mandates m on m.id = pe.mandate_id
join clients cl on cl.id = m.client_id
where pe.follow_up_on is not null and (pe.exited_at is null or pe.exit_reason = 'asked_for_time')
  and pe.follow_up_on between today_ist() - 1 and today_ist() + 120
union all
select 'joining', p.id, pe.owner_id, null, p.joining_date,
       p.candidate_id, c.full_name, m.title, cl.display_name, null, null
from placements p
join pipeline_entries pe on pe.id = p.pipeline_entry_id
join candidates c on c.id = p.candidate_id
join mandates m on m.id = p.mandate_id
join clients cl on cl.id = p.client_id
where p.joining_date is not null and p.status in ('offer_accepted', 'joined')
  and p.joining_date between today_ist() - 1 and today_ist() + 120;

create table calendar_links (
  kind       text not null check (kind in ('call', 'interview', 'follow_up', 'joining')),
  item_id    uuid not null,
  member_id  uuid not null references team_members (id) on delete cascade,
  event_id   text not null,
  hash       text not null,
  starts_on  date not null,
  removed    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (kind, item_id)
);
create index calendar_links_member_idx on calendar_links (member_id);
create trigger calendar_links_updated_at before update on calendar_links for each row execute function set_updated_at();

alter table calendar_links enable row level security;
create policy team_read   on calendar_links for select to authenticated using ((select is_team_member()));
create policy team_insert on calendar_links for insert to authenticated with check ((select is_team_member()));
create policy team_update on calendar_links for update to authenticated using ((select is_team_member())) with check ((select is_team_member()));

create table calendar_sync_state (
  id            boolean primary key default true check (id),
  running_until timestamptz not null default 'epoch',
  last_run_at   timestamptz,
  last_error    text
);
insert into calendar_sync_state (id) values (true);

alter table calendar_sync_state enable row level security;
create policy team_read   on calendar_sync_state for select to authenticated using ((select is_team_member()));
create policy team_update on calendar_sync_state for update to authenticated using ((select is_team_member())) with check ((select is_team_member()));
