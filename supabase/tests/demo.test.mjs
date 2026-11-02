// Loads the demo data on PGlite, checks every screen has something to show, then removes it
// and checks nothing is left behind.   node supabase/tests/demo.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const repo = new URL('../..', import.meta.url).pathname;
const db = new PGlite({ extensions: { pg_trgm } });
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => (await q(sql, p))[0];
let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; console.log('  ✓', m); };

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
    confirmation_token text, email_change text, email_change_token_new text, recovery_token text);
  create table auth.identities (id uuid primary key default gen_random_uuid(), provider_id text, user_id uuid, identity_data jsonb,
    provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema extensions;
  create function extensions.gen_salt(text) returns text language sql as $$ select 'salt' $$;
  create function extensions.crypt(pw text, salt text) returns text language sql as $$ select 'hashed:' || pw $$;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
for (const f of fs.readdirSync(`${repo}/supabase/migrations`).sort()) await db.exec(fs.readFileSync(`${repo}/supabase/migrations/${f}`, 'utf8'));
await db.exec(fs.readFileSync(`${repo}/supabase/seed.sql`, 'utf8'));

// A real admin who must survive the cleanup untouched.
await db.exec(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'admin@example.org');
  insert into team_members (id, full_name, email, is_admin) values ('00000000-0000-0000-0000-0000000000aa', 'Real Admin', 'admin@example.org', true);`);

const demo = fs.readFileSync(`${repo}/supabase/demo/demo_data.sql`, 'utf8');
await db.exec(demo);
await db.exec(demo); // second run is a no-op
console.log('demo data loaded (twice)');

const board = await q(`select client, title, is_stale, in_play, cvs_shared, interviewed from v_mandate_board where status in ('active','on_hold') order by client, title`);
console.log('    board:', board.map(b => `${b.client} · ${b.title}${b.is_stale ? ' [stale]' : ''} (${b.in_play}/${b.cvs_shared}/${b.interviewed})`).join(' | '));
ok(board.length === 7, '7 open mandates on the board');
ok(board.filter(b => b.is_stale).length === 2, '2 stale mandates');

const kinds = (await q(`select kind, title from v_reminders`));
console.log('    reminders:', kinds.map(k => `${k.kind}: ${k.title}`).join(' | '));
for (const k of ['invoice_to_raise', 'replacement_window_ending', 'follow_up', 'stale_mandate', 'call_today'])
  ok(kinds.some(r => r.kind === k), `reminder: ${k}`);
ok(!kinds.some(r => r.kind === 'invoice_to_raise' && r.title.includes('Manish')), 'paid placement has no invoice reminder');

const khaitan = await q(`select n.title, n.body, t.full_name as to from notifications n join team_members t on t.id = n.recipient_id
  where n.mandate_id = 'de000000-0000-4000-8000-000000000609' order by n.title`);
console.log('    Khaitan alerts:', khaitan.map(n => `${n.title} → ${n.to} [${n.body}]`).join(' | '));
for (const name of ['Ananya Rao', 'Rohan Mehta', 'Aisha Qureshi', 'Gaurav Pillai'])
  ok(khaitan.some(n => n.title.startsWith(name)), `Khaitan mandate flags ${name}`);
ok(!khaitan.some(n => n.title.startsWith('Shruti')), 'candidate already at Khaitan is not flagged');
ok(khaitan.find(n => n.title.startsWith('Ananya')).to === 'Khyati (demo)', 'Ananya alert goes to Khyati, who spoke to her');
const inPipeline = await one(`select count(*)::int n from notifications n join pipeline_entries p on p.candidate_id = n.candidate_id and p.mandate_id = n.mandate_id`);
ok(inPipeline.n === 0, 'nobody already in a pipeline gets an alert for that mandate');

ok((await q(`select * from lookup('+91 90000 10501')`))[0]?.full_name === 'Ananya Rao', 'lookup by phone');
ok((await q(`select * from lookup('linkedin.com/in/demo-kavya-reddy')`))[0]?.full_name === 'Kavya Reddy', 'lookup by LinkedIn');
ok((await q(`select * from lookup('Khaitan')`)).length >= 2, 'lookup by firm');
const dup = await q(`select * from check_duplicate('de000000-0000-4000-8000-000000000504', 'de000000-0000-4000-8000-000000000301')`);
ok(dup.some(d => d.blocking), 'Kabir would be blocked as a duplicate at JSA');
const fee = await one(`select fee_amount from placements where id = 'de000000-0000-4000-8000-000000000901'`);
ok(Number(fee.fee_amount) === 210000, 'Kavya fee 2,10,000');
ok((await one(`select next_invoice_serial from settings`)).next_invoice_serial === 14, 'real invoice series untouched (still 14)');

await db.exec(fs.readFileSync(`${repo}/supabase/demo/remove_demo_data.sql`, 'utf8'));
const left = await one(`select
  (select count(*) from candidates)::int + (select count(*) from mandates)::int + (select count(*) from clients)::int +
  (select count(*) from firms)::int + (select count(*) from notifications)::int + (select count(*) from activities)::int +
  (select count(*) from screening_calls)::int + (select count(*) from placements)::int + (select count(*) from invoices)::int as n`);
ok(left.n === 0, 'cleanup removes every demo row');
ok((await one(`select count(*)::int n from team_members`)).n === 1, 'real admin kept');
ok((await one(`select count(*)::int n from auth.users`)).n === 1, 'real login kept');
ok((await one(`select count(*)::int n from exit_reasons`)).n === 13, 'seed lists kept');
await db.exec(fs.readFileSync(`${repo}/supabase/demo/remove_demo_data.sql`, 'utf8'));
ok(true, 'cleanup is safe to run twice');
console.log(`\nAll ${passed} demo checks passed.`);
