-- Step C: send a CV share straight from the sharer's own Gmail, with the CV attached.
-- The share is logged first (cv_shares, which runs the duplicate check), then the email goes.
-- These columns record what happened to that email. The body is never stored: Gmail keeps it,
-- and the thread id lets the profile show the conversation live later (step D).
--
-- email_status   null (not sent from Covaro), sending, sent or failed
-- email_from     the Gmail address it went from
-- email_message_id, email_thread_id   Gmail's ids, for "Open in Gmail" and the replies later
-- emailed_at     when sending started, then when it went
-- email_error    why it didn't go, in plain words
--
-- claim_share_email: only the person who logged the share sends it, and only once. A failed send
-- can be tried again; one stuck at "sending" for 3 minutes (the server stopped half-way) can too.
-- finish_share_email: records the outcome of a claimed send.

alter table cv_shares
  add column email_status     text check (email_status in ('sending', 'sent', 'failed')),
  add column email_from       text,
  add column email_message_id text,
  add column email_thread_id  text,
  add column emailed_at       timestamptz,
  add column email_error      text;

create function claim_share_email(p_share uuid) returns boolean
language plpgsql security invoker set search_path = public as $$
begin
  update cv_shares
     set email_status = 'sending', emailed_at = now(), email_error = null
   where id = p_share
     and shared_by = auth.uid()
     and (email_status is null
          or email_status = 'failed'
          or (email_status = 'sending' and emailed_at < now() - interval '3 minutes'));
  return found;
end $$;

create function finish_share_email(p_share uuid, p_from text, p_message_id text, p_thread_id text, p_error text)
returns void
language plpgsql security invoker set search_path = public as $$
begin
  update cv_shares
     set email_status     = case when p_error is null then 'sent' else 'failed' end,
         email_from       = coalesce(p_from, email_from),
         email_message_id = case when p_error is null then p_message_id else email_message_id end,
         email_thread_id  = case when p_error is null then p_thread_id else email_thread_id end,
         emailed_at       = case when p_error is null then now() else emailed_at end,
         email_error      = p_error
   where id = p_share
     and shared_by = auth.uid()
     and email_status = 'sending';
end $$;

revoke execute on function claim_share_email(uuid), finish_share_email(uuid, text, text, text, text) from public, anon;
grant execute on function claim_share_email(uuid), finish_share_email(uuid, text, text, text, text) to authenticated;
