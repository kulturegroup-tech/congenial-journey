-- =====================================================================
-- Paradigm Shifters — recruitment platform, phase 1 schema
-- Postgres 15+ on Supabase. Run with `supabase db push` or in the SQL editor.
--
-- The business rules live here, in the database, so no screen can skip them:
--   check_duplicate()              duplicate + cooling-off check before a CV goes out
--   match_candidates_for_mandate() re-engagement v1 (rules, no AI)
--   pqe_years() / parse_sheet_pqe() PQE is always computed as of today
--   create_invoice()               fee, GST split, numbering, deadlines
--   lookup()                       "do we already have this person?"
-- Dates are India time (today_ist()). Money is INR rupees, annual figures.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Enums (fixed lists the logic depends on; editable lists are tables)
-- ---------------------------------------------------------------------
create type client_type      as enum ('law_firm', 'company');
create type role_category    as enum ('legal', 'support_staff');
create type candidate_source as enum ('linkedin_outreach', 'inbound', 'referral', 'odoo_import', 'sheet_import', 'other');
create type contact_source   as enum ('manual', 'weekday', 'cv', 'candidate', 'odoo_import', 'sheet_import');
create type mandate_status   as enum ('active', 'on_hold', 'filled', 'lost');
-- Order matters: stages compare with < and >.
create type pipeline_stage   as enum ('mapped', 'called', 'pitched', 'confirmed', 'cv_shared', 'interview',
                                      'assignment', 'final_round', 'offer', 'documents', 'doj_fixed', 'joined');
create type share_channel    as enum ('email', 'whatsapp', 'portal');
create type prior_route      as enum ('other_agency', 'job_portal', 'client_website', 'direct_email', 'other');
create type call_status      as enum ('scheduled', 'done', 'missed', 'cancelled');
create type call_outcome     as enum ('fit', 'not_fit', 'follow_up');
create type placement_status as enum ('offer_accepted', 'joined', 'backed_out', 'left_in_window', 'completed');
create type invoice_status   as enum ('draft', 'sent', 'part_paid', 'paid', 'cancelled');
create type tax_type         as enum ('cgst_sgst', 'igst');
create type payment_basis    as enum ('invoice_date', 'joining_date');
create type contact_role     as enum ('partner', 'hr_ta', 'other');

-- ---------------------------------------------------------------------
-- Pure helpers (needed by generated columns, so defined first)
-- ---------------------------------------------------------------------

-- Today's date in India, used everywhere instead of current_date (the server runs in UTC).
create function today_ist() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- 'https://www.linkedin.com/in/Some-One-123/?x=1' -> 'some-one-123'
create function linkedin_slug(url text) returns text
language sql immutable as $$
  select nullif(lower(substring(url from '(?i)linkedin\.com/in/([^/?#[:space:]]+)')), '')
$$;

-- Turns whatever was typed in a phone cell into clean E.164 numbers.
-- Handles: '9000000001.0' (Excel), '9000000001, 8000000002', '919000000001',
-- '090000 00001', '+91 90000 00001', two numbers run together, and junk like 'Bengaluru'.
create function normalize_phones(raw text) returns text[]
language plpgsql immutable as $$
declare
  part   text;
  digits text;
  result text[] := '{}';
begin
  if raw is null then return result; end if;
  raw := regexp_replace(raw, '\.0+(?=$|[^0-9])', '', 'g');          -- Excel float tails
  foreach part in array regexp_split_to_array(raw, '\s*(,|/|;|\||\n| or )\s*') loop
    digits := regexp_replace(part, '\D', '', 'g');
    if length(digits) = 20 then                                        -- two numbers, no separator
      result := result || normalize_phones(substr(digits, 1, 10)) || normalize_phones(substr(digits, 11, 10));
      continue;
    end if;
    if length(digits) = 12 and left(digits, 2) = '91' then digits := substr(digits, 3); end if;
    if length(digits) = 11 and left(digits, 1) = '0'  then digits := substr(digits, 2); end if;
    if length(digits) = 10 and left(digits, 1) between '2' and '9' then
      result := result || ('+91' || digits);
    elsif length(digits) between 11 and 15 and left(trim(part), 1) = '+' then  -- foreign number written with +
      result := result || ('+' || digits);
    end if;
  end loop;
  return (select coalesce(array_agg(distinct x), '{}') from unnest(result) x);
end $$;

-- PQE in years (one decimal) as of a date, from the date practice started.
create function pqe_years(practice_start date, as_of date default today_ist()) returns numeric
language sql stable as $$
  select case when practice_start is null then null else
    round((extract(year from age(as_of, practice_start)) + extract(month from age(as_of, practice_start)) / 12.0)::numeric, 1)
  end
$$;

create function seniority_band(pqe numeric) returns text
language sql immutable as $$
  select case
    when pqe is null then null
    when pqe < 1 then 'Newly qualified'
    when pqe < 3 then 'Junior (1–3)'
    when pqe < 6 then 'Mid-level (3–6)'
    else 'Senior (6+)'
  end
$$;

-- The sheets write PQE as years.months: '5.11' = 5 years 11 months, '2.8' = 2 years 8 months.
-- Also reads '6y 1m', '7 yrs 4 months'. Returns the practice start date, or null when the value
-- can't be read ('4+', '7.25', 'Check'): those rows go to the review list.
create function parse_sheet_pqe(raw text, as_of date default today_ist()) returns date
language plpgsql stable as $$
declare
  m      text[];
  years  int;
  months int := 0;
begin
  m := regexp_match(coalesce(raw, ''), '^\s*(\d{1,2})(?:\.(\d{1,2}))?\s*(?:yrs?|years?)?\s*$', 'i');
  if m is null then
    m := regexp_match(raw, '^\s*(\d{1,2})\s*y(?:rs?|ears?)?\s*(?:(\d{1,2})\s*m(?:onths?|os?)?)?\s*$', 'i');
  end if;
  if m is null then return null; end if;
  years := m[1]::int;
  if m[2] is not null then
    months := m[2]::int;
    if months > 11 then return null; end if;                          -- e.g. '2.25': ambiguous, review by hand
  end if;
  return (as_of - make_interval(years => years, months => months))::date;
end $$;

-- Mon–Fri days after d1 up to and including d2.
create function working_days_between(d1 date, d2 date) returns int
language sql immutable as $$
  select count(*)::int from generate_series(d1 + 1, d2, interval '1 day') g where extract(isodow from g) < 6
$$;

create function set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- Team and settings
-- ---------------------------------------------------------------------
create table team_members (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  is_admin    boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create function is_team_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where id = auth.uid() and active)
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where id = auth.uid() and active and is_admin)
$$;

-- One row. Everything here is editable from a Settings screen.
create table settings (
  id                              boolean primary key default true check (id),
  firm_name                       text not null default 'Paradigm Shifters',
  address                         text,
  gstin                           text,
  home_state_code                 text not null default '27',   -- Maharashtra
  invoice_prefix                  text not null default 'PS',
  next_invoice_serial             int  not null default 1,
  gst_rate                        numeric(5,2) not null default 18,
  sac_code                        text not null default '9985',
  bank_details                    text,
  stale_after_working_days        int  not null default 5,
  default_cooling_off_months      int  not null default 6,
  default_resume_validity_months  int  not null default 12,
  updated_at                      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Firms, clients, agreements
-- ---------------------------------------------------------------------

-- Every organisation: where candidates work, what they ask for, and who our clients are.
create table firms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  aliases     text[] not null default '{}',     -- 'AZB', 'AZB & Partners', 'AZB Partners'
  kind        client_type not null default 'law_firm',
  website     text,
  notes       text,
  created_at  timestamptz not null default now()
);
create unique index firms_name_key on firms (lower(name));
create index firms_name_trgm on firms using gin (name extensions.gin_trgm_ops);

-- A firm's associate grades in years, e.g. A1 = 0–1, SA1 = 5–6. Varies by firm.
create table firm_grades (
  id        uuid primary key default gen_random_uuid(),
  firm_id   uuid not null references firms (id) on delete cascade,
  grade     text not null,
  pqe_min   numeric(4,1) not null,
  pqe_max   numeric(4,1) not null,
  unique (firm_id, grade),
  check (pqe_min <= pqe_max)
);

-- Editable list used by candidates, mandates and interest tags.
create table practice_areas (
  name     text primary key,
  aliases  text[] not null default '{}',
  sort     int not null default 100,
  active   boolean not null default true
);

create table clients (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null unique references firms (id),
  display_name     text not null,
  billing_name     text,
  billing_address  text,
  gstin            text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  state_code       text generated always as (left(gstin, 2)) stored,
  owner_id         uuid references team_members (id),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table client_contacts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients (id) on delete cascade,
  name             text not null,
  role             contact_role not null default 'other',
  email            text,
  phone            text,
  city             text,
  copy_on_shares   boolean not null default false,   -- e.g. the TA team must be copied
  notes            text,
  created_at       timestamptz not null default now()
);

-- The terms that drive fees, duplicates, deadlines and reminders.
create table agreements (
  id                            uuid primary key default gen_random_uuid(),
  client_id                     uuid not null references clients (id) on delete cascade,
  title                         text not null,
  starts_on                     date not null,
  ends_on                       date,
  cooling_off_months            int  not null default 6,
  resume_validity_months        int  not null default 12,
  replacement_days              int  not null default 90,
  replacement_excludes_medical  boolean not null default true,
  invoice_deadline_days         int,               -- fee forfeited if not invoiced within N days of joining
  payment_days                  int  not null default 15,
  payment_from                  payment_basis not null default 'invoice_date',
  requires_portal               boolean not null default false,
  portal_name                   text,
  copy_ta_on_partner_shares     boolean not null default false,
  no_fee_if_backed_out          boolean not null default true,
  document_path                 text,               -- storage: agreements/<client_id>/<file>
  notes                         text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table agreement_fee_rates (
  agreement_id   uuid not null references agreements (id) on delete cascade,
  role_category  role_category not null,
  fee_percent    numeric(5,2) not null check (fee_percent > 0 and fee_percent <= 50),
  primary key (agreement_id, role_category)
);

-- The agreement in force on a date; falls back to the most recent one.
create function current_agreement(p_client uuid, p_on date default today_ist()) returns agreements
language sql stable as $$
  select a.* from agreements a
  where a.client_id = p_client
  order by (a.starts_on <= p_on and (a.ends_on is null or a.ends_on >= p_on)) desc, a.starts_on desc
  limit 1
$$;

-- ---------------------------------------------------------------------
-- Candidates
-- ---------------------------------------------------------------------
create table candidates (
  id                      uuid primary key default gen_random_uuid(),
  full_name               text not null,
  linkedin_url            text,
  linkedin_slug           text generated always as (linkedin_slug(linkedin_url)) stored,
  current_firm_id         uuid references firms (id),
  current_firm_raw        text,                    -- as typed in the source, before matching to a firm
  designation             text,
  practice_areas          text[] not null default '{}',
  practice_start_date     date,                    -- PQE is computed from this, never stored
  pqe_recorded            text,                    -- raw PQE from the source, e.g. '5.11'
  current_city            text,
  preferred_cities        text[] not null default '{}',
  graduation_year         int,
  current_ctc             numeric(12,2),           -- annual fixed, INR
  expected_ctc            numeric(12,2),
  notice_period_days      int,
  source                  candidate_source not null default 'other',
  owner_id                uuid references team_members (id),
  privacy_notice_sent_at  timestamptz,
  deletion_requested_at   timestamptz,
  needs_review            boolean not null default false,
  review_note             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index candidates_linkedin_key on candidates (linkedin_slug) where linkedin_slug is not null;
create index candidates_name_trgm on candidates using gin (full_name extensions.gin_trgm_ops);
create index candidates_firm_idx on candidates (current_firm_id);
create index candidates_practice_idx on candidates using gin (practice_areas);

-- One phone can belong to one person only: this is what makes "do we have this number?" instant.
create table candidate_phones (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates (id) on delete cascade,
  phone         text not null unique check (phone ~ '^\+[0-9]{8,15}$'),
  raw           text,
  source        contact_source not null default 'manual',
  is_primary    boolean not null default false,
  added_by      uuid references team_members (id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index candidate_phones_candidate_idx on candidate_phones (candidate_id);

create table candidate_emails (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates (id) on delete cascade,
  email         text not null check (email = lower(trim(email)) and email like '%_@_%'),
  source        contact_source not null default 'manual',
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (email)
);
create index candidate_emails_candidate_idx on candidate_emails (candidate_id);

create table candidate_files (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates (id) on delete cascade,
  storage_path  text not null,                   -- candidate-files/<candidate_id>/<uuid>.<ext>
  file_name     text not null,
  mime_type     text,
  version       int not null default 1,
  parsed_text   text,                            -- filled by the CV reader in phase 3
  uploaded_by   uuid references team_members (id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index candidate_files_candidate_idx on candidate_files (candidate_id);

-- Field 12 of the screening call, structured: where the CV has already reached.
create table prior_applications (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates (id) on delete cascade,
  firm_id       uuid not null references firms (id),
  route         prior_route not null,
  applied_on    date,                             -- unknown date = treated as recent by the duplicate check
  details       text,
  recorded_by   uuid references team_members (id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index prior_applications_idx on prior_applications (candidate_id, firm_id);

-- ---------------------------------------------------------------------
-- Mandates
-- ---------------------------------------------------------------------
create table mandates (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references clients (id),
  title                  text not null,                       -- 'TMT associate, 2–4 PQE'
  role_category          role_category not null default 'legal',
  practice_area          text references practice_areas (name) on update cascade,
  pqe_min                numeric(4,1),
  pqe_max                numeric(4,1),
  grade_label            text,                                -- 'A1–A3', as the client says it
  city                   text,
  headcount              int not null default 1 check (headcount > 0),
  received_on            date not null default today_ist(),
  owner_id               uuid references team_members (id),
  status                 mandate_status not null default 'active',
  status_changed_at      timestamptz not null default now(),
  reopened_count         int not null default 0,
  replaces_placement_id  uuid,                                -- set on replacement mandates (FK added below)
  -- intake call
  team_size              text,
  team_structure         text,
  client_profile         text,
  work_profile           text,
  soft_points            text,
  pain_points            text,
  research_notes         text,
  legacy_name            text,                                -- Odoo job position, kept for reference
  last_activity_at       timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (pqe_min is null or pqe_max is null or pqe_min <= pqe_max)
);
create index mandates_client_idx on mandates (client_id);
create index mandates_status_idx on mandates (status);

-- ---------------------------------------------------------------------
-- Screening calls (the 14-field questionnaire)
-- ---------------------------------------------------------------------
create table screening_calls (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null references candidates (id) on delete cascade,
  mandate_id          uuid references mandates (id) on delete set null,
  recruiter_id        uuid not null references team_members (id) default auth.uid(),
  status              call_status not null default 'done',
  scheduled_for       timestamptz,
  google_event_id     text,
  called_at           timestamptz,
  education           text,            -- 1  graduation year, certifications, PG diplomas
  work_history        text,            -- 2  organisations, reporting managers, reason for each move
  nature_of_work      text,            -- 3
  industries_clients  text,            -- 4
  looking_for         text,            -- 5  structured part goes to interest_tags
  team_experience     text,            -- 6  also feeds firm intelligence
  non_negotiables     text,            -- 7
  current_city        text,            -- 8
  notice_period_days  int,             -- 9
  current_ctc         numeric(12,2),   -- 10 annual fixed, INR
  expected_ctc        numeric(12,2),   -- 11
  applications_made   text,            -- 12 structured part goes to prior_applications
  discussion          text,            -- 13
  action_points       text,            -- 14
  outcome             call_outcome,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_for is not null)
);
create index screening_calls_candidate_idx on screening_calls (candidate_id, called_at desc);
create index screening_calls_recruiter_idx on screening_calls (recruiter_id, scheduled_for);

-- Field 5, structured: firms, cities, roles a candidate wants. Drives re-engagement.
create table interest_tags (
  id                 uuid primary key default gen_random_uuid(),
  candidate_id       uuid not null references candidates (id) on delete cascade,
  firm_id            uuid references firms (id),
  city               text,
  role_text          text,
  practice_area      text references practice_areas (name) on update cascade,
  not_taken_reason   text,             -- why we couldn't take them forward last time
  screening_call_id  uuid references screening_calls (id) on delete set null,
  created_by         uuid references team_members (id) default auth.uid(),
  created_at         timestamptz not null default now(),
  check (firm_id is not null or city is not null or role_text is not null or practice_area is not null)
);
create index interest_tags_candidate_idx on interest_tags (candidate_id);
create index interest_tags_firm_idx on interest_tags (firm_id);

-- ---------------------------------------------------------------------
-- Pipeline
-- ---------------------------------------------------------------------
create table exit_reasons (
  code    text primary key,
  label   text not null,
  sort    int not null default 100,
  active  boolean not null default true
);

create table pipeline_entries (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references candidates (id) on delete cascade,
  mandate_id        uuid not null references mandates (id) on delete cascade,
  stage             pipeline_stage not null default 'mapped',
  stage_changed_at  timestamptz not null default now(),
  exit_reason       text references exit_reasons (code),
  exit_note         text,
  exited_at         timestamptz,
  follow_up_on      date,
  owner_id          uuid references team_members (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (candidate_id, mandate_id),
  check (exit_reason is distinct from 'asked_for_time' or follow_up_on is not null)
);
create index pipeline_entries_mandate_idx on pipeline_entries (mandate_id, stage);
create index pipeline_entries_followup_idx on pipeline_entries (follow_up_on) where follow_up_on is not null;

-- Every CV sent. The insert runs the duplicate check and can refuse.
create table cv_shares (
  id                  uuid primary key default gen_random_uuid(),
  pipeline_entry_id   uuid not null references pipeline_entries (id) on delete cascade,
  candidate_id        uuid not null references candidates (id),     -- filled from the entry
  client_id           uuid not null references clients (id),        -- filled from the entry
  mandate_id          uuid not null references mandates (id),       -- filled from the entry
  shared_at           timestamptz not null default now(),
  channels            share_channel[] not null check (cardinality(channels) > 0),
  recipients          text,
  cv_file_id          uuid references candidate_files (id) on delete set null,
  shared_by           uuid not null references team_members (id),
  valid_until         date not null,                                -- resume validity, from the agreement
  duplicate_findings  jsonb not null default '[]',
  override_reason     text,
  created_at          timestamptz not null default now()
);
create index cv_shares_client_candidate_idx on cv_shares (client_id, candidate_id);

-- ---------------------------------------------------------------------
-- Placements, invoices, payments
-- ---------------------------------------------------------------------
create table placements (
  id                       uuid primary key default gen_random_uuid(),
  pipeline_entry_id        uuid not null unique references pipeline_entries (id),
  candidate_id             uuid not null references candidates (id),   -- filled from the entry
  client_id                uuid not null references clients (id),
  mandate_id               uuid not null references mandates (id),
  agreement_id             uuid references agreements (id),
  offer_accepted_on        date,
  joining_date             date,
  annual_fixed_salary      numeric(12,2) not null check (annual_fixed_salary > 0),
  fee_percent              numeric(5,2) check (fee_percent >= 0),     -- from the agreement unless set
  fee_amount               numeric(12,2) generated always as (round(annual_fixed_salary * fee_percent / 100, 2)) stored,
  replacement_until        date,
  status                   placement_status not null default 'offer_accepted',
  left_on                  date,
  left_reason              text,
  left_for_medical         boolean not null default false,
  replacement_mandate_id   uuid references mandates (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (status not in ('joined', 'left_in_window', 'completed') or joining_date is not null),
  check (status <> 'left_in_window' or left_on is not null)
);
alter table mandates add constraint mandates_replaces_fk foreign key (replaces_placement_id) references placements (id);

create table invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null unique,
  placement_id     uuid not null references placements (id),
  client_id        uuid not null references clients (id),
  invoice_date     date not null,
  taxable_amount   numeric(12,2) not null,
  tax              tax_type not null,
  gst_rate         numeric(5,2) not null,
  cgst             numeric(12,2) not null default 0,
  sgst             numeric(12,2) not null default 0,
  igst             numeric(12,2) not null default 0,
  total            numeric(12,2) not null,
  raise_by         date,                 -- agreement deadline; null = none
  due_on           date not null,
  status           invoice_status not null default 'draft',
  sent_by          uuid references team_members (id),
  sent_at          timestamptz,
  pdf_path         text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index invoices_one_live_per_placement on invoices (placement_id) where status <> 'cancelled';

create table payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices (id) on delete cascade,
  received_on  date not null,
  amount       numeric(12,2) not null check (amount > 0),
  reference    text,
  recorded_by  uuid references team_members (id) default auth.uid(),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Activity log, notifications, import staging
-- ---------------------------------------------------------------------
create table activities (
  id            bigint generated always as identity primary key,
  entity_type   text not null,
  entity_id     uuid,
  mandate_id    uuid references mandates (id) on delete cascade,
  candidate_id  uuid references candidates (id) on delete cascade,
  client_id     uuid references clients (id) on delete cascade,
  actor_id      uuid references team_members (id) on delete set null,
  action        text not null,
  details       jsonb,
  created_at    timestamptz not null default now()
);
create index activities_mandate_idx on activities (mandate_id, created_at desc);
create index activities_candidate_idx on activities (candidate_id, created_at desc);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references team_members (id) on delete cascade,
  kind          text not null,                 -- 'reengagement', ...
  title         text not null,
  body          text,
  mandate_id    uuid references mandates (id) on delete cascade,
  candidate_id  uuid references candidates (id) on delete cascade,
  dedupe_key    text unique,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_recipient_idx on notifications (recipient_id, read_at, created_at desc);

-- Raw rows from Odoo and the sheets, kept until each one is imported, merged or reviewed.
create table import_rows (
  id            bigint generated always as identity primary key,
  batch         text not null,                 -- 'odoo', 'sheet:Argus Partners/GC-BLR'
  row_number    int,
  raw           jsonb not null,
  candidate_id  uuid references candidates (id) on delete set null,
  status        text not null default 'pending'
                check (status in ('pending', 'imported', 'merged', 'needs_review', 'skipped')),
  issue         text,
  created_at    timestamptz not null default now()
);
create index import_rows_status_idx on import_rows (batch, status);

-- ---------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------

-- Before a CV goes to a client. Blocking findings stop the share unless overridden with a reason.
create function check_duplicate(p_candidate uuid, p_client uuid, p_exclude_entry uuid default null)
returns table (rule text, blocking boolean, detail text, seen_on date)
language plpgsql stable set search_path = public as $$
declare
  v_firm   uuid;
  v_today  date := today_ist();
  v_cool   int;
  a        agreements;
begin
  select firm_id into v_firm from clients where id = p_client;
  a := current_agreement(p_client, v_today);
  v_cool := coalesce(a.cooling_off_months, (select default_cooling_off_months from settings limit 1), 6);

  -- The CV already reached this client another way, inside the cooling-off period.
  return query
    select 'prior_application'::text,
           (pa.applied_on is null or pa.applied_on > (v_today - make_interval(months => v_cool))::date),
           format('Applied via %s%s', replace(pa.route::text, '_', ' '),
                  coalesce(' on ' || to_char(pa.applied_on, 'DD Mon YYYY'), ' (date unknown)')),
           pa.applied_on
    from prior_applications pa
    where pa.candidate_id = p_candidate and pa.firm_id = v_firm;

  -- We already sent this CV to the client and it is still valid (fine for another role, but know it).
  return query
    select 'already_shared_by_us'::text, false,
           format('We shared this CV on %s for "%s"; valid until %s',
                  to_char(cs.shared_at at time zone 'Asia/Kolkata', 'DD Mon YYYY'), m.title, to_char(cs.valid_until, 'DD Mon YYYY')),
           (cs.shared_at at time zone 'Asia/Kolkata')::date
    from cv_shares cs join mandates m on m.id = cs.mandate_id
    where cs.candidate_id = p_candidate and cs.client_id = p_client and cs.valid_until >= v_today;

  -- Someone on the team is already taking this person to this client.
  return query
    select 'in_process_for_client'::text, false,
           format('Already in process for "%s" (stage: %s)', m.title, pe.stage),
           (pe.created_at at time zone 'Asia/Kolkata')::date
    from pipeline_entries pe join mandates m on m.id = pe.mandate_id
    where pe.candidate_id = p_candidate and m.client_id = p_client and pe.exited_at is null
      and pe.stage >= 'confirmed' and (p_exclude_entry is null or pe.id <> p_exclude_entry);

  return query
    select 'works_at_client'::text, false, 'Currently works at this client'::text, null::date
    from candidates c where c.id = p_candidate and c.current_firm_id = v_firm;
end $$;

-- Re-engagement v1. A candidate matches when they asked for the client's firm,
-- or when practice area, PQE (as of today) and city all fit.
create function match_candidates_for_mandate(p_mandate uuid, p_limit int default 50)
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
      (m.practice_area is not null and (m.practice_area = any (c.practice_areas)
         or exists (select 1 from interest_tags t where t.candidate_id = c.id and t.practice_area = m.practice_area))) as practice_fit,
      m.pqe_min, m.pqe_max, m.client_firm_name, m.city as m_city, m.practice_area as m_practice, m.client_id
    from candidates c cross join m
    where c.deletion_requested_at is null
      and c.current_firm_id is distinct from m.client_firm_id
      and not exists (select 1 from pipeline_entries pe where pe.candidate_id = c.id and pe.mandate_id = m.id)
  ),
  fit as (
    select s.*,
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

-- Sends each match to the recruiter who last spoke to them (else the mandate owner, else an admin).
create function notify_reengagement(p_mandate uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  r          record;
  m          mandates;
  v_client   text;
  v_to       uuid;
  v_count    int := 0;
  v_inserted int;
begin
  select * into m from mandates where id = p_mandate;
  select display_name into v_client from clients where id = m.client_id;
  for r in select * from match_candidates_for_mandate(p_mandate, 25) loop
    v_to := coalesce(r.last_recruiter_id, m.owner_id,
                     (select id from team_members where is_admin and active order by created_at limit 1));
    continue when v_to is null;
    insert into notifications (recipient_id, kind, title, body, mandate_id, candidate_id, dedupe_key)
    values (v_to, 'reengagement',
            format('%s may fit %s · %s', r.full_name, v_client, m.title),
            array_to_string(r.reasons, ' · '), p_mandate, r.candidate_id,
            format('reengage:%s:%s:%s', p_mandate, r.candidate_id, m.reopened_count))
    on conflict (dedupe_key) do nothing;
    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;
  end loop;
  return v_count;
end $$;

-- "Do we already have this person?" Paste a LinkedIn URL, phone, email, name or firm.
create function lookup(q text, p_limit int default 25)
returns table (candidate_id uuid, full_name text, current_firm text, pqe_today numeric, phones text[],
               emails text[], linkedin_url text, last_called_by uuid, last_called_at timestamptz, matched_on text)
language sql stable set search_path = public, extensions as $$
  with i as (select trim(q) as q, normalize_phones(q) as ph, linkedin_slug(q) as slug),
  hits as (
    select c.id,
      case
        when i.slug is not null and c.linkedin_slug = i.slug then 'linkedin'
        when cardinality(i.ph) > 0 and exists (select 1 from candidate_phones p where p.candidate_id = c.id and p.phone = any (i.ph)) then 'phone'
        when i.q like '%@%' and exists (select 1 from candidate_emails e where e.candidate_id = c.id and e.email = lower(i.q)) then 'email'
        when length(i.q) >= 3 and (c.full_name ilike '%' || i.q || '%' or similarity(c.full_name, i.q) > 0.35) then 'name'
        when length(i.q) >= 3 and exists (select 1 from firms f where f.id = c.current_firm_id
               and (f.name ilike '%' || i.q || '%' or exists (select 1 from unnest(f.aliases) al where al ilike '%' || i.q || '%'))) then 'firm'
      end as matched_on,
      similarity(c.full_name, i.q) as sim
    from candidates c, i
  )
  select c.id, c.full_name, f.name, pqe_years(c.practice_start_date),
    (select coalesce(array_agg(p.phone order by p.is_primary desc, p.created_at), '{}') from candidate_phones p where p.candidate_id = c.id),
    (select coalesce(array_agg(e.email order by e.is_primary desc, e.created_at), '{}') from candidate_emails e where e.candidate_id = c.id),
    c.linkedin_url, lc.recruiter_id, lc.called_at, h.matched_on
  from hits h
  join candidates c on c.id = h.id
  left join firms f on f.id = c.current_firm_id
  left join lateral (
    select sc.recruiter_id, sc.called_at from screening_calls sc
    where sc.candidate_id = c.id and sc.status = 'done' order by sc.called_at desc nulls last limit 1
  ) lc on true
  where h.matched_on is not null
  order by case h.matched_on when 'linkedin' then 0 when 'phone' then 1 when 'email' then 2 when 'name' then 3 else 4 end,
           h.sim desc, c.full_name
  limit p_limit
$$;

-- Raises the GST invoice for a placement: fee from the agreement, CGST+SGST inside Maharashtra,
-- IGST outside, next number in the series, the agreement's deadline and due date.
create function create_invoice(p_placement uuid, p_invoice_date date default null) returns invoices
language plpgsql security definer set search_path = public as $$
declare
  p       placements;
  cl      clients;
  a       agreements;
  s       settings;
  inv     invoices;
  v_date  date := coalesce(p_invoice_date, today_ist());
  v_tax   tax_type;
  v_cgst  numeric(12,2) := 0;
  v_sgst  numeric(12,2) := 0;
  v_igst  numeric(12,2) := 0;
begin
  if auth.uid() is not null and not is_team_member() then raise exception 'Not allowed'; end if;
  select * into p from placements where id = p_placement;
  if not found then raise exception 'Placement not found'; end if;
  if p.status not in ('joined', 'left_in_window', 'completed') then
    raise exception 'Invoice only after the candidate joins (status: %)', p.status;
  end if;
  if coalesce(p.fee_amount, 0) <= 0 then raise exception 'No fee on this placement; check the fee %%'; end if;
  if exists (select 1 from invoices where placement_id = p.id and status <> 'cancelled') then
    raise exception 'This placement already has an invoice';
  end if;
  select * into cl from clients where id = p.client_id;
  if cl.gstin is null then raise exception 'Add the client''s GSTIN before invoicing'; end if;
  select * into a from agreements where id = p.agreement_id;
  select * into s from settings for update;

  v_tax := case when cl.state_code = s.home_state_code then 'cgst_sgst' else 'igst' end::tax_type;
  if v_tax = 'cgst_sgst' then
    v_cgst := round(p.fee_amount * s.gst_rate / 200, 2);
    v_sgst := v_cgst;
  else
    v_igst := round(p.fee_amount * s.gst_rate / 100, 2);
  end if;

  insert into invoices (invoice_number, placement_id, client_id, invoice_date, taxable_amount, tax, gst_rate,
                        cgst, sgst, igst, total, raise_by, due_on)
  values (format('%s-%s-%s', s.invoice_prefix, s.next_invoice_serial, to_char(v_date, 'YY')),
          p.id, p.client_id, v_date, p.fee_amount, v_tax, s.gst_rate, v_cgst, v_sgst, v_igst,
          p.fee_amount + v_cgst + v_sgst + v_igst,
          case when a.invoice_deadline_days is not null then p.joining_date + a.invoice_deadline_days end,
          case when a.payment_from = 'joining_date' then p.joining_date + coalesce(a.payment_days, 15)
               else v_date + coalesce(a.payment_days, 15) end)
  returning * into inv;

  update settings set next_invoice_serial = next_invoice_serial + 1, updated_at = now();
  return inv;
end $$;

-- Merges two candidate records found to be the same person (admin, or the import script).
create function merge_candidates(p_keep uuid, p_drop uuid) returns void
language plpgsql set search_path = public as $$
declare
  k candidates;
  d candidates;
begin
  if p_keep = p_drop then raise exception 'Pick two different candidates'; end if;
  if auth.uid() is not null and not is_admin() then raise exception 'Only an admin can merge candidates'; end if;
  select * into k from candidates where id = p_keep for update;
  select * into d from candidates where id = p_drop for update;
  if k.id is null or d.id is null then raise exception 'Candidate not found'; end if;
  if exists (select 1 from pipeline_entries a join pipeline_entries b on a.mandate_id = b.mandate_id
             where a.candidate_id = p_keep and b.candidate_id = p_drop) then
    raise exception 'Both records are on the same mandate; close one of those pipeline entries first';
  end if;

  perform set_config('app.bypass_guards', 'on', true);
  update candidate_phones   set candidate_id = p_keep where candidate_id = p_drop;
  update candidate_emails   set candidate_id = p_keep where candidate_id = p_drop;
  update candidate_files    set candidate_id = p_keep where candidate_id = p_drop;
  update prior_applications set candidate_id = p_keep where candidate_id = p_drop;
  update screening_calls    set candidate_id = p_keep where candidate_id = p_drop;
  update interest_tags      set candidate_id = p_keep where candidate_id = p_drop;
  update pipeline_entries   set candidate_id = p_keep where candidate_id = p_drop;
  update cv_shares          set candidate_id = p_keep where candidate_id = p_drop;
  update placements         set candidate_id = p_keep where candidate_id = p_drop;
  update activities         set candidate_id = p_keep where candidate_id = p_drop;
  update notifications      set candidate_id = p_keep where candidate_id = p_drop;
  update import_rows        set candidate_id = p_keep, status = 'merged' where candidate_id = p_drop;

  delete from candidates where id = p_drop;
  update candidates set
    linkedin_url        = coalesce(k.linkedin_url, d.linkedin_url),
    current_firm_id     = coalesce(k.current_firm_id, d.current_firm_id),
    current_firm_raw    = coalesce(k.current_firm_raw, d.current_firm_raw),
    designation         = coalesce(k.designation, d.designation),
    practice_areas      = (select coalesce(array_agg(distinct x), '{}') from unnest(k.practice_areas || d.practice_areas) x),
    practice_start_date = coalesce(k.practice_start_date, d.practice_start_date),
    current_city        = coalesce(k.current_city, d.current_city),
    preferred_cities    = (select coalesce(array_agg(distinct x), '{}') from unnest(k.preferred_cities || d.preferred_cities) x),
    graduation_year     = coalesce(k.graduation_year, d.graduation_year),
    current_ctc         = coalesce(k.current_ctc, d.current_ctc),
    expected_ctc        = coalesce(k.expected_ctc, d.expected_ctc),
    notice_period_days  = coalesce(k.notice_period_days, d.notice_period_days),
    owner_id            = coalesce(k.owner_id, d.owner_id)
  where id = p_keep;

  insert into activities (entity_type, entity_id, candidate_id, actor_id, action, details)
  values ('candidates', p_keep, p_keep, auth.uid(), 'merged', jsonb_build_object('merged_name', d.full_name));
  perform set_config('app.bypass_guards', 'off', true);
end $$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Activity log: creations, stage/status/exit/owner changes. Other edits are not logged.
create function log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r       jsonb := to_jsonb(new);
  o       jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_action  text := 'created';
  v_details jsonb;
begin
  if tg_op = 'UPDATE' then
    if r ? 'stage' and r->>'stage' is distinct from o->>'stage' then
      v_action := 'stage_changed';
      v_details := jsonb_build_object('from', o->>'stage', 'to', r->>'stage');
    elsif r ? 'exit_reason' and r->>'exit_reason' is distinct from o->>'exit_reason' then
      v_action := case when r->>'exit_reason' is null then 'reopened' else 'exited' end;
      v_details := jsonb_build_object('reason', coalesce(r->>'exit_reason', o->>'exit_reason'), 'note', r->>'exit_note');
    elsif r ? 'status' and r->>'status' is distinct from o->>'status' then
      v_action := 'status_changed';
      v_details := jsonb_build_object('from', o->>'status', 'to', r->>'status');
    elsif r ? 'owner_id' and r->>'owner_id' is distinct from o->>'owner_id' then
      v_action := 'owner_changed';
      v_details := jsonb_build_object('from', o->>'owner_id', 'to', r->>'owner_id');
    else
      return new;
    end if;
  end if;

  insert into activities (entity_type, entity_id, mandate_id, candidate_id, client_id, actor_id, action, details)
  values (tg_table_name, (r->>'id')::uuid,
          case when tg_table_name = 'mandates' then (r->>'id')::uuid else (r->>'mandate_id')::uuid end,
          (r->>'candidate_id')::uuid,
          (r->>'client_id')::uuid,
          auth.uid(), v_action, v_details);
  return new;
end $$;

-- Any activity on a mandate keeps it from going stale.
create function touch_mandate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mandate_id is not null then
    update mandates set last_activity_at = new.created_at where id = new.mandate_id and last_activity_at < new.created_at;
  end if;
  return null;
end $$;

create function mandate_before_status() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    if new.status = 'active' then new.reopened_count := old.reopened_count + 1; end if;
  end if;
  return new;
end $$;

create function mandate_after_open() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform notify_reengagement(new.id);
  end if;
  return null;
end $$;

create function pipeline_before() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := coalesce(new.owner_id, auth.uid(), (select owner_id from mandates where id = new.mandate_id));
  end if;
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    -- A CV can only reach the client through cv_shares, which runs the duplicate check.
    if new.stage >= 'cv_shared' and old.stage < 'cv_shared'
       and coalesce(current_setting('app.bypass_guards', true), 'off') <> 'on'
       and not exists (select 1 from cv_shares where pipeline_entry_id = new.id) then
      raise exception 'Log the CV share first: it runs the duplicate check';
    end if;
  end if;
  if new.exit_reason is not null and (tg_op = 'INSERT' or old.exit_reason is null) then
    new.exited_at := now();
  elsif new.exit_reason is null then
    new.exited_at := null;
  end if;
  return new;
end $$;

create function cv_share_before_insert() returns trigger
language plpgsql set search_path = public as $$
declare
  e         pipeline_entries;
  m         mandates;
  a         agreements;
  v_find    jsonb;
  v_block   int;
  v_day     date;
begin
  select * into e from pipeline_entries where id = new.pipeline_entry_id;
  if not found then raise exception 'Pipeline entry not found'; end if;
  if e.exited_at is not null then
    raise exception 'This candidate has exited this mandate (%). Reopen the entry before sharing.', e.exit_reason;
  end if;
  select * into m from mandates where id = e.mandate_id;
  new.candidate_id := e.candidate_id;
  new.mandate_id   := e.mandate_id;
  new.client_id    := m.client_id;
  new.shared_by    := coalesce(new.shared_by, auth.uid());

  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb), count(*) filter (where d.blocking)
    into v_find, v_block
  from check_duplicate(e.candidate_id, m.client_id, e.id) d;
  new.duplicate_findings := v_find;

  if v_block > 0 and coalesce(trim(new.override_reason), '') = '' then
    raise exception using
      message = 'DUPLICATE_BLOCKED',
      detail  = v_find::text,
      hint    = 'Shown to the recruiter; to share anyway, retry with override_reason filled in.';
  end if;

  v_day := (new.shared_at at time zone 'Asia/Kolkata')::date;
  a := current_agreement(m.client_id, v_day);
  new.valid_until := (v_day + make_interval(months => coalesce(a.resume_validity_months,
                       (select default_resume_validity_months from settings limit 1), 12)))::date;
  return new;
end $$;

create function cv_share_after_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  update pipeline_entries set stage = 'cv_shared' where id = new.pipeline_entry_id and stage < 'cv_shared';
  return null;
end $$;

-- A finished screening call refreshes the candidate's current details and moves 'mapped' to 'called'.
create function screening_call_after() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'done' then
    update candidates set
      current_city       = coalesce(new.current_city, current_city),
      notice_period_days = coalesce(new.notice_period_days, notice_period_days),
      current_ctc        = coalesce(new.current_ctc, current_ctc),
      expected_ctc       = coalesce(new.expected_ctc, expected_ctc)
    where id = new.candidate_id;
    if new.mandate_id is not null then
      update pipeline_entries set stage = 'called'
      where candidate_id = new.candidate_id and mandate_id = new.mandate_id and stage = 'mapped';
    end if;
  end if;
  return null;
end $$;

create function screening_call_before() returns trigger
language plpgsql as $$
begin
  if new.status = 'done' and new.called_at is null then new.called_at := now(); end if;
  return new;
end $$;

create function placement_before() returns trigger
language plpgsql set search_path = public as $$
declare
  e  pipeline_entries;
  m  mandates;
  a  agreements;
begin
  select * into e from pipeline_entries where id = new.pipeline_entry_id;
  if not found then raise exception 'Pipeline entry not found'; end if;
  select * into m from mandates where id = e.mandate_id;
  new.candidate_id := e.candidate_id;
  new.mandate_id   := e.mandate_id;
  new.client_id    := m.client_id;

  if new.agreement_id is null then
    a := current_agreement(m.client_id, coalesce(new.joining_date, new.offer_accepted_on, today_ist()));
    new.agreement_id := a.id;
  else
    select * into a from agreements where id = new.agreement_id;
  end if;

  if m.replaces_placement_id is not null then
    new.fee_percent := 0;                                            -- replacements carry no new fee
  elsif new.fee_percent is null then
    select r.fee_percent into new.fee_percent
    from agreement_fee_rates r where r.agreement_id = a.id and r.role_category = m.role_category;
  end if;

  if new.joining_date is not null then
    new.replacement_until := new.joining_date + coalesce(a.replacement_days, 90);
  end if;
  return new;
end $$;

create function placement_after() returns trigger
language plpgsql set search_path = public as $$
declare
  a      agreements;
  v_new  uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;

  if new.status = 'joined' then
    perform set_config('app.bypass_guards', 'on', true);
    update pipeline_entries set stage = 'joined' where id = new.pipeline_entry_id;
    perform set_config('app.bypass_guards', 'off', true);
  elsif new.status = 'backed_out' then
    update pipeline_entries set exit_reason = 'backed_out', exit_note = coalesce(exit_note, 'Backed out before joining')
    where id = new.pipeline_entry_id and exit_reason is null;
  elsif new.status = 'left_in_window' and new.replacement_mandate_id is null then
    select * into a from agreements where id = new.agreement_id;
    if new.left_on <= new.replacement_until
       and not (new.left_for_medical and coalesce(a.replacement_excludes_medical, false)) then
      insert into mandates (client_id, title, role_category, practice_area, pqe_min, pqe_max, grade_label, city,
                            owner_id, replaces_placement_id, team_size, team_structure, client_profile,
                            work_profile, soft_points, pain_points, research_notes)
      select client_id, 'Replacement: ' || title, role_category, practice_area, pqe_min, pqe_max, grade_label, city,
             owner_id, new.id, team_size, team_structure, client_profile, work_profile, soft_points, pain_points, research_notes
      from mandates where id = new.mandate_id
      returning id into v_new;
      update placements set replacement_mandate_id = v_new where id = new.id;
    end if;
  end if;
  return null;
end $$;

create function payment_after() returns trigger
language plpgsql set search_path = public as $$
declare
  v_paid   numeric;
  v_total  numeric;
  v_id     uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  select coalesce(sum(amount), 0) into v_paid from payments where invoice_id = v_id;
  select total into v_total from invoices where id = v_id;
  update invoices set status = case when v_paid >= v_total then 'paid'
                                    when v_paid > 0 then 'part_paid'
                                    else 'sent' end::invoice_status
  where id = v_id and status <> 'cancelled';
  return null;
end $$;

create trigger mandates_updated_at        before update on mandates         for each row execute function set_updated_at();
create trigger candidates_updated_at      before update on candidates       for each row execute function set_updated_at();
create trigger clients_updated_at         before update on clients          for each row execute function set_updated_at();
create trigger agreements_updated_at      before update on agreements       for each row execute function set_updated_at();
create trigger pipeline_updated_at        before update on pipeline_entries for each row execute function set_updated_at();
create trigger screening_calls_updated_at before update on screening_calls  for each row execute function set_updated_at();
create trigger placements_updated_at      before update on placements       for each row execute function set_updated_at();
create trigger invoices_updated_at        before update on invoices         for each row execute function set_updated_at();

create trigger mandates_status_before  before update of status on mandates for each row execute function mandate_before_status();
create trigger mandates_open_after     after insert or update of status on mandates for each row execute function mandate_after_open();
create trigger pipeline_before_trg     before insert or update on pipeline_entries for each row execute function pipeline_before();
create trigger cv_shares_before_trg    before insert on cv_shares for each row execute function cv_share_before_insert();
create trigger cv_shares_after_trg     after insert on cv_shares for each row execute function cv_share_after_insert();
create trigger calls_before_trg        before insert or update on screening_calls for each row execute function screening_call_before();
create trigger calls_after_trg         after insert or update on screening_calls for each row execute function screening_call_after();
create trigger placements_before_trg   before insert or update on placements for each row execute function placement_before();
create trigger placements_after_trg    after insert or update on placements for each row execute function placement_after();
create trigger payments_after_trg      after insert or update or delete on payments for each row execute function payment_after();
create trigger activities_touch        after insert on activities for each row execute function touch_mandate();

create trigger log_mandates   after insert or update on mandates         for each row execute function log_activity();
create trigger log_pipeline   after insert or update on pipeline_entries for each row execute function log_activity();
create trigger log_calls      after insert or update of status on screening_calls for each row execute function log_activity();
create trigger log_shares     after insert on cv_shares                  for each row execute function log_activity();
create trigger log_placements after insert or update on placements       for each row execute function log_activity();
create trigger log_invoices   after insert or update on invoices         for each row execute function log_activity();

-- ---------------------------------------------------------------------
-- Views (security_invoker: they respect row-level security)
-- ---------------------------------------------------------------------
create view v_candidates with (security_invoker = on) as
select c.*,
  pqe_years(c.practice_start_date)                 as pqe_today,
  seniority_band(pqe_years(c.practice_start_date)) as seniority,
  f.name                                           as current_firm,
  (select coalesce(array_agg(p.phone order by p.is_primary desc, p.created_at), '{}')
     from candidate_phones p where p.candidate_id = c.id) as phones,
  (select coalesce(array_agg(e.email order by e.is_primary desc, e.created_at), '{}')
     from candidate_emails e where e.candidate_id = c.id) as emails,
  lc.recruiter_id as last_called_by,
  lc.called_at    as last_called_at
from candidates c
left join firms f on f.id = c.current_firm_id
left join lateral (
  select sc.recruiter_id, sc.called_at from screening_calls sc
  where sc.candidate_id = c.id and sc.status = 'done' order by sc.called_at desc nulls last limit 1
) lc on true;

create view v_mandate_board with (security_invoker = on) as
select m.id, m.title, m.status, m.client_id, cl.display_name as client, m.city, m.practice_area,
  m.pqe_min, m.pqe_max, m.grade_label, m.owner_id, m.received_on, m.last_activity_at,
  today_ist() - m.received_on as days_open,
  (m.status = 'active' and working_days_between((m.last_activity_at at time zone 'Asia/Kolkata')::date, today_ist())
     >= s.stale_after_working_days) as is_stale,
  count(pe.id) filter (where pe.exited_at is null)        as in_play,
  count(pe.id) filter (where pe.stage >= 'cv_shared')     as cvs_shared,
  count(pe.id) filter (where pe.stage >= 'interview')     as interviewed,
  count(pe.id) filter (where pe.stage = 'joined')         as joined
from mandates m
join clients cl on cl.id = m.client_id
cross join settings s
left join pipeline_entries pe on pe.mandate_id = m.id
group by m.id, cl.display_name, s.stale_after_working_days;

-- CVs still inside their validity window: a fee is due if the client hires them.
create view v_live_submissions with (security_invoker = on) as
select cs.id, cs.client_id, cl.display_name as client, cs.candidate_id, c.full_name, cs.mandate_id, m.title as mandate,
  cs.shared_at, cs.valid_until, cs.shared_by,
  exists (select 1 from placements p where p.candidate_id = cs.candidate_id and p.client_id = cs.client_id) as placed
from cv_shares cs
join clients cl on cl.id = cs.client_id
join candidates c on c.id = cs.candidate_id
join mandates m on m.id = cs.mandate_id
where cs.valid_until >= today_ist();

-- Everything that needs someone's attention, one row each. The daily digest reads this.
create view v_reminders with (security_invoker = on) as
-- an invoice to raise (fee forfeited after the agreement's deadline)
select 'invoice_to_raise'::text as kind, m.owner_id as recipient_id,
  coalesce(p.joining_date + a.invoice_deadline_days, p.joining_date) as due_on,
  format('Raise invoice for %s at %s%s', c.full_name, cl.display_name,
         case when a.invoice_deadline_days is not null
              then format(' (deadline %s)', to_char(p.joining_date + a.invoice_deadline_days, 'DD Mon')) else '' end) as title,
  p.mandate_id, p.candidate_id, p.client_id, p.id as ref_id
from placements p
join mandates m on m.id = p.mandate_id
join candidates c on c.id = p.candidate_id
join clients cl on cl.id = p.client_id
left join agreements a on a.id = p.agreement_id
where p.status in ('joined', 'left_in_window', 'completed') and coalesce(p.fee_amount, 0) > 0
  and not exists (select 1 from invoices i where i.placement_id = p.id and i.status not in ('draft', 'cancelled'))
union all
-- payment due within 3 days or overdue: the person who sent the invoice follows up
select case when i.due_on < today_ist() then 'payment_overdue' else 'payment_due' end, i.sent_by, i.due_on,
  format('%s: %s from %s', i.invoice_number, to_char(i.total, 'FM99,99,99,999'), cl.display_name),
  p.mandate_id, p.candidate_id, i.client_id, i.id
from invoices i join placements p on p.id = i.placement_id join clients cl on cl.id = i.client_id
where i.status in ('sent', 'part_paid') and i.due_on <= today_ist() + 3
union all
select 'replacement_window_ending', m.owner_id, p.replacement_until,
  format('Replacement window for %s at %s ends', c.full_name, cl.display_name),
  p.mandate_id, p.candidate_id, p.client_id, p.id
from placements p join mandates m on m.id = p.mandate_id join candidates c on c.id = p.candidate_id
join clients cl on cl.id = p.client_id
where p.status = 'joined' and p.replacement_until between today_ist() and today_ist() + 14
union all
select 'follow_up', pe.owner_id, pe.follow_up_on, format('Follow up with %s for %s', c.full_name, m.title),
  pe.mandate_id, pe.candidate_id, m.client_id, pe.id
from pipeline_entries pe join candidates c on c.id = pe.candidate_id join mandates m on m.id = pe.mandate_id
where pe.follow_up_on <= today_ist() and (pe.exited_at is null or pe.exit_reason = 'asked_for_time')
union all
select 'stale_mandate', b.owner_id, (b.last_activity_at at time zone 'Asia/Kolkata')::date,
  format('No activity on %s · %s', b.client, b.title), b.id, null, b.client_id, b.id
from v_mandate_board b where b.is_stale
union all
select 'call_today', sc.recruiter_id, (sc.scheduled_for at time zone 'Asia/Kolkata')::date,
  format('Call %s at %s', c.full_name, to_char(sc.scheduled_for at time zone 'Asia/Kolkata', 'HH12:MI AM')),
  sc.mandate_id, sc.candidate_id, null, sc.id
from screening_calls sc join candidates c on c.id = sc.candidate_id
where sc.status = 'scheduled' and (sc.scheduled_for at time zone 'Asia/Kolkata')::date = today_ist()
union all
select 'agreement_expiring', cl.owner_id, a.ends_on, format('Agreement with %s ends', cl.display_name),
  null, null, a.client_id, a.id
from agreements a join clients cl on cl.id = a.client_id
where a.ends_on between today_ist() and today_ist() + 30;

-- ---------------------------------------------------------------------
-- Row-level security: every active team member sees and edits everything;
-- deletes are admin-only. Tighten later by editing these policies.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'firms', 'firm_grades', 'practice_areas', 'clients', 'client_contacts', 'agreements', 'agreement_fee_rates',
    'candidates', 'candidate_phones', 'candidate_emails', 'candidate_files', 'prior_applications', 'mandates',
    'screening_calls', 'interest_tags', 'exit_reasons', 'pipeline_entries', 'cv_shares', 'placements',
    'invoices', 'payments', 'import_rows'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy team_read   on %I for select to authenticated using (is_team_member())', t);
    execute format('create policy team_insert on %I for insert to authenticated with check (is_team_member())', t);
    execute format('create policy team_update on %I for update to authenticated using (is_team_member()) with check (is_team_member())', t);
    execute format('create policy admin_delete on %I for delete to authenticated using (is_admin())', t);
  end loop;
end $$;

alter table team_members enable row level security;
create policy team_read    on team_members for select to authenticated using (is_team_member());
create policy admin_write  on team_members for all    to authenticated using (is_admin()) with check (is_admin());

alter table settings enable row level security;
create policy team_read    on settings for select to authenticated using (is_team_member());
create policy admin_update on settings for update to authenticated using (is_admin()) with check (is_admin());

alter table activities enable row level security;
create policy team_read    on activities for select to authenticated using (is_team_member());

alter table notifications enable row level security;
create policy own_read     on notifications for select to authenticated using (recipient_id = auth.uid() or is_admin());
create policy own_update   on notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Nothing is reachable without signing in.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function notify_reengagement(uuid), create_invoice(uuid, date), merge_candidates(uuid, uuid)
      from public, anon;
  end if;
end $$;
