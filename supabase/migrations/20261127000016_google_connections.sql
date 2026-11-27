-- Connect Google (step A of Gmail + Google Calendar): each team member links their own Google
-- account once, from Settings. Later steps use it to send CV shares from their Gmail, show emails
-- with a candidate or client, and keep calls and interviews in step with Google Calendar.
--
-- refresh_token_enc  the long-lived Google token, encrypted by the app server (AES-256-GCM) with a
--                    key only the server has (GOOGLE_TOKEN_KEY). The database never sees it in the
--                    clear, so a copy of this table alone can't reach anyone's Gmail.
-- status             connected / disconnected (they unlinked it) / broken (Google stopped accepting
--                    it, e.g. password changed or access removed by their admin): reconnect.
--
-- The team can see who is connected (a teammate's interview goes on the owner's calendar); a person
-- links, relinks or unlinks only their own account. Nobody deletes rows: unlinking clears the token.

create table google_connections (
  member_id         uuid primary key references team_members (id) on delete cascade,
  google_email      text not null,
  scopes            text[] not null default '{}',
  refresh_token_enc text,
  status            text not null default 'connected' check (status in ('connected', 'disconnected', 'broken')),
  last_error        text,
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (status <> 'connected' or refresh_token_enc is not null)
);

create trigger google_connections_updated_at before update on google_connections for each row execute function set_updated_at();

alter table google_connections enable row level security;
create policy team_read  on google_connections for select to authenticated using ((select is_team_member()));
create policy own_insert on google_connections for insert to authenticated
  with check ((select is_team_member()) and member_id = (select auth.uid()));
create policy own_update on google_connections for update to authenticated
  using ((select is_team_member()) and member_id = (select auth.uid()))
  with check ((select is_team_member()) and member_id = (select auth.uid()));
