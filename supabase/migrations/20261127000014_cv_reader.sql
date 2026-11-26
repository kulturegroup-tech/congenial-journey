-- The CV reader (Ankit's feedback): drop in one or many CVs (PDF or Word), the AI reads each,
-- and the team reviews the details before a candidate is created.
--
-- cv_inbox      one row per uploaded CV, from upload to "saved as a candidate" (or discarded).
--               The file sits in the private candidate-files bucket under inbox/ until it's saved.
-- highlights    3 or 4 lines on what stands out in a candidate's CV, written by the AI, editable.
-- ai_cv_reading the firm's own switch. Off by default: CV text goes to the Claude API (Anthropic)
--               only once an admin turns it on (the one outside service the guardrails allow).

alter table settings add column ai_cv_reading boolean not null default false;

alter table candidates add column highlights text;

create table cv_inbox (
  id           uuid primary key default gen_random_uuid(),
  file_path    text not null,
  file_name    text not null,
  mime_type    text,
  status       text not null default 'uploaded'
               check (status in ('uploaded', 'reading', 'ready', 'failed', 'saved', 'discarded')),
  extracted    jsonb,
  error        text,
  candidate_id uuid references candidates (id) on delete set null,
  uploaded_by  uuid references team_members (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index cv_inbox_open_idx      on cv_inbox (created_at desc) where status not in ('saved', 'discarded');
create index cv_inbox_candidate_idx on cv_inbox (candidate_id);
create index cv_inbox_by_idx        on cv_inbox (uploaded_by);

create trigger cv_inbox_updated_at before update on cv_inbox for each row execute function set_updated_at();

alter table cv_inbox enable row level security;
create policy team_read    on cv_inbox for select to authenticated using ((select is_team_member()));
create policy team_insert  on cv_inbox for insert to authenticated with check ((select is_team_member()));
create policy team_update  on cv_inbox for update to authenticated using ((select is_team_member())) with check ((select is_team_member()));
create policy admin_delete on cv_inbox for delete to authenticated using ((select is_admin()));
