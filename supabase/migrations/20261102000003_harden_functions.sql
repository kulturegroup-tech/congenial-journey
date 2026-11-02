-- Fixes from Supabase's security advisor.

-- 1. Pin search_path on every function that didn't set one.
alter function today_ist()                    set search_path = public;
alter function linkedin_slug(text)            set search_path = public;
alter function normalize_phones(text)         set search_path = public;
alter function pqe_years(date, date)          set search_path = public;
alter function seniority_band(numeric)        set search_path = public;
alter function parse_sheet_pqe(text, date)    set search_path = public;
alter function working_days_between(date, date) set search_path = public;
alter function set_updated_at()               set search_path = public;
alter function current_agreement(uuid, date)  set search_path = public;
alter function mandate_before_status()        set search_path = public;
alter function screening_call_before()        set search_path = public;

-- 2. Trigger and internal functions are never called over the API. Triggers still fire:
--    Postgres checks EXECUTE when a trigger is created, not when it runs.
revoke execute on function log_activity(), touch_mandate(), mandate_after_open(), notify_reengagement(uuid)
  from public, anon, authenticated;

-- 3. RLS helpers: signed-in users need them (policies call them); visitors don't.
revoke execute on function is_team_member(), is_admin() from public, anon;
