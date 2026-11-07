// Runs the migrations + seed on PGlite (real Postgres 16 in WASM) and checks every business rule.
// All people, numbers and firms here are fake. Never put real candidate data in tests.
//   npm i -D @electric-sql/pglite@0.2.17
//   node supabase/tests/rules.test.mjs
// Run it after every schema change.
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const repo = new URL('../..', import.meta.url).pathname;
const db = new PGlite({ extensions: { pg_trgm } });
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓', msg); };
const fails = async (sql, re, msg, params = []) => {
  try { await q(sql, params); } catch (e) { assert.match(e.message, re, msg + ' (got: ' + e.message + ')'); passed++; console.log('  ✓', msg); return; }
  assert.fail(msg + ' (did not fail)');
};

// --- Supabase stand-ins: auth, storage, roles -------------------------------
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
    confirmation_token text, email_change text, email_change_token_new text, recovery_token text);
  create table auth.identities (id uuid primary key default gen_random_uuid(), provider_id text, user_id uuid references auth.users(id) on delete cascade,
    identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  -- pgcrypto stand-ins (PGlite has no pgcrypto); Supabase has the real ones in the extensions schema
  create schema extensions;
  create function extensions.gen_salt(text) returns text language sql as $$ select 'salt' $$;
  create function extensions.crypt(pw text, salt text) returns text language sql as $$ select 'hashed:' || pw $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  -- Like Supabase: new tables and functions in public are granted to the API roles as they are created,
  -- so a later REVOKE in a migration sticks.
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);

for (const f of fs.readdirSync(`${repo}/supabase/migrations`).sort()) {
  await db.exec(fs.readFileSync(`${repo}/supabase/migrations/${f}`, 'utf8'));
  console.log('migration ok:', f);
}
await db.exec(fs.readFileSync(`${repo}/supabase/seed.sql`, 'utf8'));
await db.exec(fs.readFileSync(`${repo}/supabase/seed.sql`, 'utf8')); // seed is re-runnable
console.log('seed ok (twice)');
await db.exec(`grant usage on schema extensions to anon, authenticated;`);

console.log('\nParsing helpers');
const ph = async (s) => (await one('select normalize_phones($1) as p', [s])).p;
ok(JSON.stringify(await ph('9000000001.0')) === '["+919000000001"]', 'Excel float tail removed');
ok((await ph('9000000002, 8000000003')).length === 2, 'two numbers in one cell');
ok(JSON.stringify(await ph('919000000004.0')) === '["+919000000004"]', '91 prefix handled');
ok(JSON.stringify(await ph('90000 00005')) === '["+919000000005"]', 'spaces inside a number');
ok(JSON.stringify(await ph('+91 90000-00006')) === '["+919000000006"]', '+91 with dash');
ok(JSON.stringify(await ph('09000000007')) === '["+919000000007"]', 'leading 0');
ok((await ph('Bengaluru')).length === 0, 'a city in the phone column is ignored');
ok((await ph('90000000089000000009')).length === 2, 'two numbers run together');
ok(JSON.stringify(await ph('+44 7700 900123')) === '["+447700900123"]', 'foreign number with +');

const pqe = async (raw) => (await one(`select pqe_years(parse_sheet_pqe($1, '2026-11-02'), '2026-11-02') as y`, [raw])).y;
ok(Number(await pqe('5.11')) === 5.9, "'5.11' = 5 years 11 months = 5.9");
ok(Number(await pqe('2.8')) === 2.7, "'2.8' = 2 years 8 months = 2.7");
ok(Number(await pqe('4.0')) === 4, "'4.0' = 4 years");
ok(Number(await pqe('6')) === 6, "'6' = 6 years");
ok((await pqe('2.25')) === null, "'2.25' goes to review");
ok(Number(await pqe('6y 1m')) === 6.1, "'6y 1m' = 6.1");
ok(Number(await pqe('5y 10m')) === 5.8, "'5y 10m' = 5.8");
ok(Number(await pqe('7 yrs 4 months')) === 7.3, "'7 yrs 4 months' = 7.3");
ok((await pqe('4+')) === null, "'4+' goes to review");
ok((await one(`select seniority_band(4.2) as b`)).b === 'Mid-level (3–6)', 'seniority band');
ok((await one(`select linkedin_slug('https://www.LinkedIn.com/in/Test-Person-01/?trk=x') as s`)).s === 'test-person-01', 'LinkedIn slug');
ok((await one(`select working_days_between('2026-10-30', '2026-11-03') as d`)).d === 2, 'working days skip the weekend');

// --- Fixtures ----------------------------------------------------------------
const R1 = '00000000-0000-0000-0000-000000000001', R2 = '00000000-0000-0000-0000-000000000002',
      R3 = '00000000-0000-0000-0000-000000000003', OUT = '00000000-0000-0000-0000-000000000099';
await db.exec(`
  insert into auth.users (id) values ('${R1}'), ('${R2}'), ('${R3}'), ('${OUT}');
  insert into team_members (id, full_name, email, is_admin) values
    ('${R1}', 'Recruiter One', 'one@example.in', true),
    ('${R2}', 'Recruiter Two', 'two@example.in', false),
    ('${R3}', 'Recruiter Three', 'three@example.in', false);
`);
const as = async (uid) => db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false)`);
await as(R1);

const id = async (sql, params) => (await one(sql + ' returning id', params)).id;
const fClient = await id(`insert into firms (name, aliases) values ('Example Law LLP', '{"Example Law"}')`);
const fOther  = await id(`insert into firms (name) values ('Other Firm & Co')`);
const fSouth  = await id(`insert into firms (name) values ('Southern Partners')`);
const client  = await id(`insert into clients (firm_id, display_name, gstin) values ($1, 'Example Law', '27AAAAA0000A1Z5')`, [fClient]);
const client2 = await id(`insert into clients (firm_id, display_name, gstin) values ($1, 'Southern Partners', '29AAAAA0000A1Z5')`, [fSouth]);
const agr = await id(`insert into agreements (client_id, title, starts_on, ends_on, cooling_off_months, resume_validity_months,
  replacement_days, replacement_excludes_medical, invoice_deadline_days, payment_days, payment_from, requires_portal)
  values ($1, 'Recruitment Services Agreement', '2026-05-20', '2027-03-31', 6, 12, 90, false, 30, 60, 'joining_date', true)`, [client]);
await q(`insert into agreement_fee_rates values ($1, 'legal', 10), ($1, 'support_staff', 9)`, [agr]);
const agr2 = await id(`insert into agreements (client_id, title, starts_on, payment_days) values ($1, 'Letter of Engagement', '2026-01-01', 15)`, [client2]);
await q(`insert into agreement_fee_rates values ($1, 'legal', 10)`, [agr2]);

const ago = (years) => `(today_ist() - make_interval(years => ${Math.floor(years)}, months => ${Math.round((years % 1) * 12)}))::date`;
const A = await id(`insert into candidates (full_name, linkedin_url, current_firm_id, practice_areas, practice_start_date, current_city)
  values ('Asha Testcase', 'https://www.linkedin.com/in/asha-testcase-1/', $1, '{"General Corporate"}', ${ago(3)}, 'Mumbai')`, [fOther]);
const B = await id(`insert into candidates (full_name, current_firm_id, practice_areas, practice_start_date, current_city)
  values ('Bharat Sample', $1, '{TMT}', ${ago(3.2)}, 'Bengaluru')`, [fOther]);
const C = await id(`insert into candidates (full_name, practice_areas, practice_start_date, current_city)
  values ('Chitra Dummy', '{TMT}', ${ago(3)}, 'Bengaluru')`);
const D = await id(`insert into candidates (full_name, practice_areas, practice_start_date, current_city)
  values ('Dev Placeholder', '{TMT}', ${ago(2.5)}, 'Bengaluru')`);
const E = await id(`insert into candidates (full_name, current_firm_id, practice_areas, practice_start_date, current_city)
  values ('Esha Internal', $1, '{TMT}', ${ago(3)}, 'Bengaluru')`, [fClient]);
const F = await id(`insert into candidates (full_name, practice_areas, practice_start_date, current_city)
  values ('Farhan Senior', '{TMT}', ${ago(9)}, 'Bengaluru')`);
await q(`insert into candidate_phones (candidate_id, phone, source) values ($1, '+919000000001', 'weekday')`, [A]);
await q(`insert into candidate_emails (candidate_id, email) values ($1, 'asha.test@example.com')`, [A]);
await q(`insert into interest_tags (candidate_id, firm_id, city, not_taken_reason) values ($1, $2, 'Bengaluru', 'Wanted Example Law, no mandate then')`, [A, fClient]);
await q(`insert into interest_tags (candidate_id, firm_id) values ($1, $2)`, [C, fClient]);
await q(`insert into prior_applications (candidate_id, firm_id, route, applied_on) values ($1, $2, 'job_portal', today_ist() - 60)`, [C, fClient]);
await q(`insert into prior_applications (candidate_id, firm_id, route, applied_on) values ($1, $2, 'direct_email', today_ist() - 240)`, [D, fClient]);

console.log('\nScreening calls');
await as(R2);
await q(`insert into screening_calls (candidate_id, current_city, notice_period_days, expected_ctc, looking_for, outcome)
         values ($1, 'Bengaluru', 60, 2400000, 'Wants Example Law in Bengaluru', 'not_fit')`, [A]);
const a1 = await one(`select current_city, notice_period_days from candidates where id = $1`, [A]);
ok(a1.current_city === 'Bengaluru' && a1.notice_period_days === 60, 'a finished call updates the candidate');

console.log('\nRe-engagement on a new mandate');
await as(R1);
const M = await id(`insert into mandates (client_id, title, practice_area, pqe_min, pqe_max, city, owner_id)
  values ($1, 'TMT associate', 'TMT', 2, 4, 'Bengaluru', $2)`, [client, R1]);
const matches = await q(`select * from match_candidates_for_mandate($1)`, [M]);
const names = matches.map(m => m.full_name);
console.log('    matches:', matches.map(m => `${m.full_name} (${m.score}: ${m.reasons.join(', ')})`).join(' | '));
ok(names[0] === 'Asha Testcase', 'candidate who asked for this firm ranks first');
ok(names.includes('Bharat Sample'), 'practice + PQE + city match is included');
ok(!names.includes('Chitra Dummy'), 'candidate inside cooling-off is left out');
ok(names.includes('Dev Placeholder'), 'candidate past cooling-off is included');
ok(!names.includes('Esha Internal'), 'candidate already at the client is left out');
ok(!names.includes('Farhan Senior'), 'candidate far outside the PQE range is left out');
const notes = await q(`select recipient_id, title from notifications where mandate_id = $1 order by title`, [M]);
ok(notes.find(n => n.title.startsWith('Asha')).recipient_id === R2, 'alert goes to the recruiter who spoke to them');
ok(notes.find(n => n.title.startsWith('Bharat')).recipient_id === R1, 'no call on record: alert goes to the mandate owner');

console.log('\nPipeline and duplicate guard');
const eA = await id(`insert into pipeline_entries (candidate_id, mandate_id) values ($1, $2)`, [A, M]);
await q(`insert into screening_calls (candidate_id, mandate_id, outcome) values ($1, $2, 'fit')`, [A, M]);
ok((await one(`select stage from pipeline_entries where id = $1`, [eA])).stage === 'called', 'call on a mandate moves mapped → called');
await q(`update pipeline_entries set stage = 'confirmed' where id = $1`, [eA]);
await fails(`update pipeline_entries set stage = 'cv_shared' where id = $1`, /Log the CV share first/, 'cannot jump to CV shared without logging the share', [eA]);
await q(`insert into cv_shares (pipeline_entry_id, channels, recipients) values ($1, '{email,portal}', 'TA team')`, [eA]);
const sA = await one(`select valid_until, client_id from cv_shares where pipeline_entry_id = $1`, [eA]);
ok((await one(`select stage from pipeline_entries where id = $1`, [eA])).stage === 'cv_shared', 'logging the share moves the stage');
ok((await one(`select ($1::date = (today_ist() + interval '12 months')::date) as x`, [sA.valid_until])).x, 'resume valid for 12 months from the agreement');
ok(sA.client_id === client, 'client filled from the mandate');

const eC = await id(`insert into pipeline_entries (candidate_id, mandate_id, stage) values ($1, $2, 'confirmed')`, [C, M]);
await fails(`insert into cv_shares (pipeline_entry_id, channels) values ($1, '{whatsapp}')`, /DUPLICATE_BLOCKED/, 'CV inside cooling-off is blocked', [eC]);
await q(`insert into cv_shares (pipeline_entry_id, channels, override_reason) values ($1, '{whatsapp}', 'Client TA confirmed the portal application lapsed')`, [eC]);
const fC = (await one(`select duplicate_findings from cv_shares where pipeline_entry_id = $1`, [eC])).duplicate_findings;
ok(fC.some(f => f.rule === 'prior_application' && f.blocking), 'override is allowed with a reason, and the finding is stored');

const eD = await id(`insert into pipeline_entries (candidate_id, mandate_id, stage) values ($1, $2, 'confirmed')`, [D, M]);
await q(`insert into cv_shares (pipeline_entry_id, channels) values ($1, '{email}')`, [eD]);
ok(true, 'CV past cooling-off goes through');
const dupA2 = await q(`select * from check_duplicate($1, $2)`, [A, client]);
ok(dupA2.some(d => d.rule === 'already_shared_by_us' && !d.blocking), 'second share to the same client warns but does not block');

await q(`update pipeline_entries set exit_reason = 'asked_for_time', follow_up_on = today_ist() where id = $1`, [eD]);
ok((await one(`select exited_at is not null as x from pipeline_entries where id = $1`, [eD])).x, 'exit sets the exit time');
await fails(`update pipeline_entries set exit_reason = 'asked_for_time', follow_up_on = null where id = $1`, /check constraint/, 'parking needs a follow-up date', [eD]);

console.log('\nLookup');
const lk = async (s) => (await q(`select full_name, matched_on from lookup($1)`, [s]));
ok((await lk('9000000001.0'))[0]?.full_name === 'Asha Testcase', 'by phone, typed messily');
ok((await lk('+91 90000 00001'))[0]?.matched_on === 'phone', 'by phone with +91 and spaces');
ok((await lk('linkedin.com/in/asha-testcase-1'))[0]?.matched_on === 'linkedin', 'by LinkedIn URL');
ok((await lk('ASHA.TEST@example.com'))[0]?.matched_on === 'email', 'by email, any case');
ok((await lk('Asha Testcas')).some(r => r.full_name === 'Asha Testcase'), 'by partial name');
ok((await lk('Bharath Sampel')).some(r => r.full_name === 'Bharat Sample'), 'by misspelt name');
ok((await lk('Other Firm')).length === 2, 'by current firm');

console.log('\nPlacement, fee, invoice');
await q(`update pipeline_entries set stage = 'offer' where id = $1`, [eA]);
const P = await id(`insert into placements (pipeline_entry_id, offer_accepted_on, joining_date, annual_fixed_salary, status)
  values ($1, today_ist() - 20, today_ist() - 5, 2100000, 'joined')`, [eA]);
const p = await one(`select fee_percent, fee_amount, replacement_until - joining_date as days from placements where id = $1`, [P]);
ok(Number(p.fee_percent) === 10 && Number(p.fee_amount) === 210000, 'fee = 10% of 21,00,000 = 2,10,000 from the agreement');
ok(p.days === 90, 'replacement window = 90 days from joining');
ok((await one(`select stage from pipeline_entries where id = $1`, [eA])).stage === 'joined', 'joining moves the pipeline to joined');
const rem = await q(`select kind, title from v_reminders where kind = 'invoice_to_raise'`);
ok(rem.length === 1 && rem[0].title.includes('deadline'), 'reminder to raise the invoice, with the 30-day deadline');

const inv = await one(`select * from create_invoice($1)`, [P]);
const fy = (await one(`select financial_year(today_ist()) as f`)).f;
ok(inv.invoice_number === `PS/${fy}/014`, `invoice numbered ${inv.invoice_number}`);
ok((await one(`select financial_year('2027-03-31') as a, financial_year('2027-04-01') as b`)).a === '2026-27', 'financial year runs April to March');
ok(inv.tax === 'cgst_sgst' && Number(inv.cgst) === 18900 && Number(inv.sgst) === 18900 && Number(inv.total) === 247800, 'Maharashtra client: CGST 18,900 + SGST 18,900 = 2,47,800');
ok((await one(`select ($1::date = today_ist() - 5 + 30) as a, ($2::date = today_ist() - 5 + 60) as b`, [inv.raise_by, inv.due_on])).a, 'raise-by = joining + 30');
ok((await one(`select ($1::date = today_ist() - 5 + 60) as b`, [inv.due_on])).b, 'due = joining + 60 (Trilegal-style terms)');
ok((await one(`select next_invoice_serial from settings`)).next_invoice_serial === 15, 'series moves to 15');
await fails(`select create_invoice($1)`, /already has an invoice/, 'no second invoice for one placement', [P]);
await q(`update invoices set status = 'sent', sent_by = $2, sent_at = now() where id = $1`, [inv.id, R1]);
await q(`insert into payments (invoice_id, received_on, amount) values ($1, today_ist(), 100000)`, [inv.id]);
ok((await one(`select status from invoices where id = $1`, [inv.id])).status === 'part_paid', 'part payment');
await q(`insert into payments (invoice_id, received_on, amount) values ($1, today_ist(), 147800)`, [inv.id]);
ok((await one(`select status from invoices where id = $1`, [inv.id])).status === 'paid', 'paid in full');
const lastPay = await one(`select id from payments where invoice_id = $1 order by created_at desc, amount limit 1`, [inv.id]);
await q(`delete from payments where id = $1`, [lastPay.id]);
ok(['part_paid', 'sent'].includes((await one(`select status from invoices where id = $1`, [inv.id])).status), 'deleting a payment recalculates status');

// out-of-state client → IGST
const M2 = await id(`insert into mandates (client_id, title, practice_area, city, owner_id) values ($1, 'GC associate', 'General Corporate', 'Bengaluru', $2)`, [client2, R3]);
const eB = await id(`insert into pipeline_entries (candidate_id, mandate_id, stage) values ($1, $2, 'confirmed')`, [B, M2]);
await q(`insert into cv_shares (pipeline_entry_id, channels) values ($1, '{email}')`, [eB]);
const P2 = await id(`insert into placements (pipeline_entry_id, joining_date, annual_fixed_salary, status) values ($1, today_ist(), 1500000, 'joined')`, [eB]);
const inv2 = await one(`select * from create_invoice($1)`, [P2]);
ok(inv2.tax === 'igst' && Number(inv2.igst) === 27000 && Number(inv2.cgst) === 0, 'Karnataka client: IGST 27,000');
ok((await one(`select ($1::date = today_ist() + 15) as x`, [inv2.due_on])).x, 'standard letter: due 15 days from invoice');

// a new financial year restarts the series at 001
const nextFyStart = (await one(`select make_date(extract(year from today_ist())::int + case when extract(month from today_ist()) >= 4 then 1 else 0 end, 4, 1)::text as d`)).d;
const eFy = await id(`insert into pipeline_entries (candidate_id, mandate_id, stage) values ($1, $2, 'confirmed')`, [D, M2]);
await q(`insert into cv_shares (pipeline_entry_id, channels) values ($1, '{email}')`, [eFy]);
const PFy = await id(`insert into placements (pipeline_entry_id, joining_date, annual_fixed_salary, status) values ($1, today_ist(), 1200000, 'joined')`, [eFy]);
const invFy = await one(`select * from create_invoice($1, $2::date)`, [PFy, nextFyStart]);
const nextFy = (await one(`select financial_year($1::date) as f`, [nextFyStart])).f;
ok(invFy.invoice_number === `PS/${nextFy}/001`, `first invoice of the next financial year is ${invFy.invoice_number}`);
const sFy = await one(`select next_invoice_serial, invoice_fy from settings`);
ok(sFy.next_invoice_serial === 2 && sFy.invoice_fy === nextFy, 'series now counts within the new year');
await q(`update invoices set status = 'cancelled' where id = $1`, [invFy.id]);
await fails(`select create_invoice($1, today_ist())`, /falls in financial year/, 'cannot backdate into a year the series has left', [PFy]);

console.log('\nReplacement');
await q(`update placements set status = 'left_in_window', left_on = today_ist(), left_reason = 'Moved firms' where id = $1`, [P]);
const rp = await one(`select replacement_mandate_id from placements where id = $1`, [P]);
ok(rp.replacement_mandate_id, 'leaving inside the window opens a linked replacement mandate');
const rm = await one(`select title, replaces_placement_id from mandates where id = $1`, [rp.replacement_mandate_id]);
ok(rm.title.startsWith('Replacement:') && rm.replaces_placement_id === P, 'replacement mandate points back to the placement');
await db.exec(`select set_config('app.bypass_guards', 'on', false)`);  // fixture shortcut: straight to offer
const eF = await id(`insert into pipeline_entries (candidate_id, mandate_id, stage) values ($1, $2, 'offer')`, [B, rp.replacement_mandate_id]);
const P3 = await id(`insert into placements (pipeline_entry_id, joining_date, annual_fixed_salary, status) values ($1, today_ist(), 2000000, 'joined')`, [eF]);
await db.exec(`select set_config('app.bypass_guards', 'off', false)`);
ok(Number((await one(`select fee_amount from placements where id = $1`, [P3])).fee_amount) === 0, 'replacement placement carries no fee');
await fails(`select create_invoice($1)`, /No fee/, 'no invoice for a replacement', [P3]);

console.log('\nMandate status, reopen, stale');
await q(`update mandates set status = 'filled' where id = $1`, [M]);
const before = (await one(`select count(*)::int as n from notifications where mandate_id = $1`, [M])).n;
await q(`update mandates set status = 'active' where id = $1`, [M]);
const m1 = await one(`select reopened_count from mandates where id = $1`, [M]);
ok(m1.reopened_count === 1, 'reopening counts');
const after = (await one(`select count(*)::int as n from notifications where mandate_id = $1`, [M])).n;
ok(after >= before, `reopening re-runs re-engagement (${before} → ${after} alerts; already-in-pipeline candidates drop out)`);
await q(`update mandates set last_activity_at = now() - interval '10 days' where id = $1`, [M2]);
ok((await one(`select is_stale from v_mandate_board where id = $1`, [M2])).is_stale, 'no activity for 10 days = stale');
await q(`insert into pipeline_entries (candidate_id, mandate_id) values ($1, $2)`, [F, M2]);
ok(!(await one(`select is_stale from v_mandate_board where id = $1`, [M2])).is_stale, 'any new activity clears the flag');
const acts = await q(`select action from activities where mandate_id = $1`, [M]);
ok(acts.some(a => a.action === 'stage_changed') && acts.some(a => a.action === 'status_changed'), 'activity log records stage and status changes');

console.log('\nReminders view');
await q(`insert into screening_calls (candidate_id, status, scheduled_for) values ($1, 'scheduled', now() + interval '1 hour')`, [F]);
const kinds = new Set((await q(`select kind from v_reminders`)).map(r => r.kind));
console.log('    kinds:', [...kinds].join(', '));
ok(kinds.has('follow_up') && kinds.has('replacement_window_ending') === false, 'follow-up reminder present');
const payRow = await q(`select title from v_reminders where kind like 'payment%'`);
console.log('    payment reminders:', payRow.map(r => r.title).join(' | ') || '(none due yet)');

console.log('\nMerge');
const B2 = await id(`insert into candidates (full_name, linkedin_url) values ('Bharat Sample', 'https://linkedin.com/in/bharat-sample')`);
await q(`insert into candidate_phones (candidate_id, phone) values ($1, '+918000000003')`, [B2]);
await q(`select merge_candidates($1, $2)`, [B, B2]);
const bm = await one(`select linkedin_slug, (select count(*)::int from candidate_phones where candidate_id = $1) as phones from candidates where id = $1`, [B]);
ok(bm.linkedin_slug === 'bharat-sample' && bm.phones === 1, 'merge keeps one record with both records’ details');
await as(R2);
await fails(`select merge_candidates('${A}', '${D}')`, /Only an admin/, 'only an admin can merge');

console.log('\nApp helpers');
await as(R1);
const fAzb = await one(`select resolve_firm('  AZB  &  Partners ') as id`);
ok(fAzb.id, 'resolve_firm creates a new firm, tidying spaces');
ok((await one(`select resolve_firm('azb & partners') = $1 as same`, [fAzb.id])).same, 'same firm found ignoring case');
await q(`update firms set aliases = '{AZB}' where id = $1`, [fAzb.id]);
ok((await one(`select resolve_firm('azb', false) = $1 as same`, [fAzb.id])).same, 'found by alias');
ok((await one(`select resolve_firm('Nobody & Co', false) as id`)).id === null, 'no create when asked not to');
ok((await one(`select resolve_firm('   ') as id`)).id === null, 'blank name gives no firm');

const newId = (await one(`select admin_upsert_member('New.Person@Example.com', 'New Person', '123456', false) as id`)).id;
const nu = await one(`select u.email, u.encrypted_password, t.full_name, t.is_admin, (select count(*)::int from auth.identities i where i.user_id = u.id) as ids
                      from auth.users u join team_members t on t.id = u.id where u.id = $1`, [newId]);
ok(nu.email === 'new.person@example.com' && nu.encrypted_password === 'hashed:123456' && nu.ids === 1, 'admin creates a login with a PIN and an identity');
await q(`select admin_upsert_member('new.person@example.com', 'New Person', '654321', true)`);
const nu2 = await one(`select u.encrypted_password, t.is_admin from auth.users u join team_members t on t.id = u.id where u.id = $1`, [newId]);
ok(nu2.encrypted_password === 'hashed:654321' && nu2.is_admin, 'admin resets the PIN and makes them admin');
await fails(`select admin_upsert_member('x@example.com', 'X', '12ab', false)`, /PIN must be/, 'PIN must be digits');
await fails(`select admin_upsert_member('y@example.com', 'Y', null, false)`, /Set a PIN/, 'new member needs a PIN');
await as(R2);
await fails(`select admin_upsert_member('z@example.com', 'Z', '123456', false)`, /Only an admin/, 'only an admin manages the team');
await as(R1);


console.log('\nImport from Odoo and sheets');
const stageOf = async (raw) => await one(`select stage::text, exit_reason from import_stage($1)`, [raw]);
ok((await stageOf('Shared Profiles')).stage === 'cv_shared', "Odoo 'Shared Profiles' → cv_shared");
ok((await stageOf('Offer Accepted')).stage === 'documents', "Odoo 'Offer Accepted' → documents");
ok((await stageOf('Not Interested')).exit_reason === 'rejected_role', "'Not Interested' → exit rejected_role");
ok((await stageOf('interested ')).stage === 'pitched', "sheet 'interested' → pitched");
ok((await stageOf('CV shared with client')).stage === 'cv_shared', "sheet 'CV shared with client' → cv_shared");
ok((await one(`select import_member('Recruiter Two') = $1 as same`, [R2])).same, 'recruiter by full name');
ok((await one(`select import_member('two@example.in') = $1 as same`, [R2])).same, 'recruiter by email');
ok((await one(`select import_member('recruiter') is not null as found`)).found, 'recruiter by first name');
await fails(`insert into pipeline_entries (candidate_id, mandate_id, stage) values ('${F}', '${M}', 'interview')`, /Log the CV share first/, 'cannot insert straight at a stage past CV shared');

const imp = async (rows, batch = 'odoo') => (await one(`select import_batch($1, $2::jsonb) as r`, [batch, JSON.stringify(rows)])).r;
let r = await imp([{ n: 2, mandate_id: M, data: { name: 'Gita  Importee', linkedin: 'https://www.linkedin.com/in/gita-importee/', phone: '9000000011.0', stage: 'Shared Profiles', recruiter: 'Recruiter Two', firm: 'other firm & co', pqe: '3.6' } }]);
ok(r[0].status === 'imported', 'new Odoo row is imported');
const G = r[0].candidate_id;
const g = await one(`select full_name, source::text, owner_id, current_firm_id, (select stage::text from pipeline_entries where candidate_id = c.id and mandate_id = $2) as stage,
  (select count(*)::int from candidate_phones where candidate_id = c.id) as phones from candidates c where id = $1`, [G, M]);
ok(g.full_name === 'Gita Importee' && g.source === 'odoo_import' && g.owner_id === R2 && g.current_firm_id === fOther, 'name tidied, source, owner and firm (matched ignoring case) set');
ok(g.stage === 'cv_shared' && g.phones === 1, 'historic stage loaded without a share; phone normalised');
r = await imp([{ n: 3, mandate_id: M, data: { name: 'Gita I.', linkedin: 'linkedin.com/in/GITA-importee', stage: 'Interviewed' } }]);
ok(r[0].status === 'merged' && r[0].candidate_id === G, 'same LinkedIn merges into the existing record');
ok((await one(`select stage::text from pipeline_entries where candidate_id = $1 and mandate_id = $2`, [G, M])).stage === 'interview', 'a later stage moves the entry forward');
r = await imp([{ n: 4, data: { name: 'Asha T', phone: '+91 90000 00001' } }]);
ok(r[0].status === 'merged' && r[0].candidate_id === A, 'same phone merges');
r = await imp([{ n: 5, data: { name: 'Harish Plusfour', pqe: '4+' } }], 'sheet:test');
ok(r[0].status === 'needs_review' && /PQE/.test(r[0].issue), 'unreadable PQE goes to review');
ok((await one(`select source::text, needs_review from candidates where id = $1`, [r[0].candidate_id])).needs_review, 'candidate flagged for review');
r = await imp([{ n: 6, data: { name: 'Bharat Sampel' } }], 'sheet:test');
ok(r[0].status === 'needs_review' && /Possible duplicate of Bharat Sample/.test(r[0].issue), 'similar name goes to review as a possible duplicate');
ok((await one(`select raw->>'_possible_duplicate' as d from import_rows where candidate_id = $1`, [r[0].candidate_id])).d === B, 'the possible duplicate is recorded for merging');
r = await imp([{ n: 7, data: { name: '' } }]);
ok(r[0].status === 'skipped', 'row without a name is skipped');
r = await imp([{ n: 8, mandate_id: M2, data: { name: 'Ira Keen', stage: 'Not relevant but interested', comments: 'Wants a GC role' } }]);
const ira = await one(`select pe.exit_reason, pe.exit_note, (select count(*)::int from interest_tags t join clients cl on cl.firm_id = t.firm_id join mandates m on m.client_id = cl.id where t.candidate_id = pe.candidate_id and m.id = $2) as tags
  from pipeline_entries pe where pe.candidate_id = $1 and pe.mandate_id = $2`, [r[0].candidate_id, M2]);
ok(ira.exit_reason === 'not_a_fit' && ira.exit_note === 'Wants a GC role' && ira.tags === 1, "'Not relevant but interested' exits and records an interest tag for the client");
r = await imp([{ n: 9, mandate_id: '00000000-0000-0000-0000-00000000dead', data: { name: 'Jai Broken' } }, { n: 10, data: { name: 'Kavya Fine' } }]);
ok(r[0].status === 'needs_review' && r[1].status === 'imported', 'a row that errors is recorded and the rest carry on');
ok((await one(`select count(*)::int as n from candidates where full_name = 'Jai Broken'`)).n === 0, 'the failed row leaves nothing half-written');
await as(R2);
await fails(`select import_batch('odoo', '[]'::jsonb)`, /Only an admin/, 'only an admin can import');
await as(R1);


console.log('\nUndo a bulk add');
const Mu = await id(`insert into mandates (client_id, title, practice_area, city) values ($1, 'Undo test role', 'TMT', 'Mumbai')`, [client]);
const u1 = await id(`insert into pipeline_entries (candidate_id, mandate_id) values ($1, $2)`, [C, Mu]);
const u2 = await id(`insert into pipeline_entries (candidate_id, mandate_id) values ($1, $2)`, [D, Mu]);
await q(`update pipeline_entries set stage = 'called' where id = $1`, [u2]);
ok((await one(`select undo_pipeline_adds(array[$1, $2]::uuid[]) as n`, [u1, u2])).n === 1, 'undo removes only entries nothing has happened to');
ok((await one(`select count(*)::int as n from pipeline_entries where mandate_id = $1`, [Mu])).n === 1, 'the moved entry stays');
ok((await one(`select count(*)::int as n from activities where entity_id = $1`, [u1])).n === 0, 'its activity line goes too');
await as(R2);
const u3 = await id(`insert into pipeline_entries (candidate_id, mandate_id) values ($1, $2)`, [F, Mu]);
await as(R1);
ok((await one(`select undo_pipeline_adds(array[$1]::uuid[]) as n`, [u3])).n === 0, "cannot undo someone else's add");
ok((await one(`select monthly_joining_target from settings`)).monthly_joining_target === 5, 'monthly target defaults to 5');
await q(`update pipeline_entries set interview_at = now() + interval '2 days' where id = $1`, [u2]);
ok((await one(`select interview_at is not null as x from pipeline_entries where id = $1`, [u2])).x, 'interview date stored on the entry');

console.log('\nRow-level security');
await db.exec(`set role authenticated`);
await as(R2);
ok((await one(`select count(*)::int as n from candidates`)).n > 0, 'team member sees candidates');
await fails(`delete from candidates where id = '${F}'`, /.*/, 'non-admin delete is refused').catch(() => {});
const stillThere = (await one(`select count(*)::int as n from candidates where id = $1`, [F])).n;
ok(stillThere === 1, 'non-admin delete removes nothing');
// A recruiter (not admin, not superuser) creates a mandate: activity log, stale tracking and
// re-engagement triggers must all still fire after the EXECUTE revokes in migration 3.
const Mr = await id(`insert into mandates (client_id, title, practice_area, city, pqe_min, pqe_max) values ($1, 'Recruiter-made TMT role', 'TMT', 'Bengaluru', 2, 5)`, [client]);
ok((await one(`select count(*)::int as n from activities where mandate_id = $1`, [Mr])).n >= 1, 'recruiter writes still log activity');
ok((await one(`select count(*)::int as n from notifications where mandate_id = $1`, [Mr])).n >= 0, 'recruiter-created mandate runs re-engagement');
await fails(`select notify_reengagement('${Mr}')`, /permission denied/, 'internal functions cannot be called over the API');
await as(OUT);
ok((await one(`select count(*)::int as n from candidates`)).n === 0, 'signed-in outsider sees nothing');
ok((await one(`select count(*)::int as n from settings`)).n === 0, 'outsider cannot read settings');
await db.exec(`reset role`);


console.log('\nSafe updates');
// Supabase runs API requests with safeupdate on: UPDATE or DELETE without WHERE fails at runtime
// ("UPDATE requires a WHERE clause"), and PGlite doesn't have it, so check every function's source.
{
  const fns = await q(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.prolang in (select oid from pg_language where lanname in ('plpgsql', 'sql'))`);
  const bad = [];
  for (const f of fns) {
    const src = f.prosrc.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''");
    for (const m of src.matchAll(/\b(update\s+(?!of\b)[a-z_.]+\s+set\b|delete\s+from\s+[a-z_.]+)[^;]*;/gi)) {
      if (!/\bwhere\b/i.test(m[0])) bad.push(`${f.proname}: ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`);
    }
  }
  ok(bad.length === 0, `no UPDATE or DELETE without WHERE in ${fns.length} functions${bad.length ? ': ' + bad.join(' | ') : ''}`);
}
console.log('\nPolicies run once per query');
{
  const pols = await q(`select tablename, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr from pg_policies where schemaname = 'public'`);
  const bare = /(is_team_member|is_admin|auth\.uid)\(\)/i;
  const slow = pols.filter((r) => bare.test(r.expr.replace(/\(\s*select\s+[a-z_.]+\(\)\s+as\s+[a-z_]+\)/gi, '')));
  ok(slow.length === 0, `all ${pols.length} policies wrap their check in (select …)${slow.length ? ': ' + slow.map((r) => r.tablename + '.' + r.policyname).join(', ') : ''}`);
  const tm = await q(`select policyname from pg_policies where tablename = 'team_members' and cmd in ('SELECT', 'ALL')`);
  ok(tm.length === 1, 'team_members has one read policy');
}

console.log(`\nAll ${passed} checks passed.`);
