# Covaro — recruitment workspace

A workspace for legal recruitment firms: one candidate database, mandate tracker, duplicate guard and billing. First built for Paradigm Shifters, replacing Odoo and their sheets. Next.js 16 on Render, Supabase for the database and sign-in.

Building with Claude Code? Start with `CLAUDE.md`.

| | App | Supabase project |
| --- | --- | --- |
| Paradigm Shifters (live, real data) | https://paradigm-shifters.onrender.com (Render, Starter, Singapore) | `paradigm-shifters-live`, ref `jrpekdeeyzlbmyghwlta`, Mumbai |
| Demo (fake data only) | https://covaro-app.vercel.app | `paradigm-shifters`, ref `fqsqfxshjedljagxytat`, Mumbai |

**Setting up another firm:** follow `docs/new-firm-setup.md` (about an hour, about $17 a month).

## Environment variables

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fqsqfxshjedljagxytat.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key |
| `ALLOWED_EMAIL_DOMAINS` | `paradigmshifters.in` |
| `ALLOWED_EMAILS` | extra people allowed to sign in, comma-separated (e.g. the developer) |
| `NEXT_PUBLIC_GOOGLE_SIGNIN` | `on` once Google is enabled in Supabase; until then the Google button is hidden |

Render (and Vercel for the demo) reads these at build time: after changing one, deploy again.

**Email sign-in links:** Supabase's built-in mailer only delivers to members of the Supabase organisation and sends a few emails an hour. For the team to use email links, add custom SMTP in Supabase → Authentication → Emails → SMTP (e.g. Resend or ZeptoMail with a verified paradigmshifters.in sender). Google sign-in needs none of this.

## Add the team

Each person signs in once (this creates their login), then an admin adds them. The first admin goes in through the Supabase SQL editor:

```sql
insert into team_members (id, full_name, email, is_admin)
select id, 'Khyati Shrestha', email, true from auth.users where email = 'khyati@paradigmshifters.in';
```

Until someone has a `team_members` row, they see an "Almost there" screen and no data.

### Email + PIN sign-in (temporary, until Google or SMTP is set up)

The login page signs in with email + PIN by default. A PIN is a Supabase password, set by an admin in the SQL editor for a user who already exists in `auth.users`:

```sql
update auth.users set encrypted_password = extensions.crypt('<6-digit PIN>', extensions.gen_salt('bf')), updated_at = now()
where email = '<their email>';
```

To create a brand-new user with a PIN, use Supabase → Authentication → Users → Add user → "Create new user" (tick "Auto confirm"). Replace PINs with Google sign-in before real data goes in.

## Demo data

Fictional demo data (28 made-up candidates, 9 mandates, placements, reminders, re-engagement alerts) lives in `supabase/demo/`. Every demo row's id starts with `de000000-`.

- Load: run `supabase/demo/demo_data.sql` in the SQL editor (does nothing if already loaded)
- **Reset after a demo:** `npm run -s demo:reset-sql | pbcopy`, then paste into the demo project's SQL editor and run. It removes every demo row and loads them again with today's dates, and refuses to run where there's no demo data (the live project)
- Remove: run `supabase/demo/remove_demo_data.sql`. Real rows are never touched
- Check all three: `npm run test:demo`

Demo data lives in the demo project only. Never load it into a firm's live project.

## Database changes

Add a new file in `supabase/migrations/` (never edit an applied one), run `npm run test:db`, then apply it to the Supabase project.

## Local development

```bash
cp .env.example .env.local   # fill in the values above
npm install
npm run dev                  # http://localhost:3000
npm run test:db              # checks every business rule on an in-memory Postgres
```

## What's live

- **Lookup** (⌘K): paste a LinkedIn URL, phone (any format), email or name. Shows phones, last call and open mandates; Enter opens the first match; "Add as new candidate" when there's none
- **Candidates**: list with filters (practice area, city, seniority, PQE range); profile with contacts, CVs (private storage), screening calls, what they want, where they've already applied, mandates and activity; add and edit
- **Screening call form**: the 14 fields plus interest tags and prior applications in one screen; Ctrl/⌘+Enter saves
- **Mandates**: board with stale flags and tabs (open, filled, lost); mandate page with intake, a drag-and-drop pipeline, exits with reasons, "Past candidates who fit", CVs shared and activity
- **CV share dialog**: duplicate check, override reason when blocked, then email or WhatsApp with the note filled in; copies the TA team when the agreement says so
- **Clients**: contacts, agreement terms and fee rates, signed PDF upload, live submissions
- **Billing**: placements, invoices (GST split and numbering from the database), printable tax invoice, payments, outstanding and overdue
- **Reminders** and the **bell**: re-engagement alerts, calls today, follow-ups, stale mandates, invoices and payments
- **Settings**: team and PINs (admin), change my PIN, firm details printed on invoices, defaults, practice areas

- **Import** (Settings → Import): Odoo export or a sheet tab as CSV; matches on LinkedIn, phone and email, with a review list for near-matches
