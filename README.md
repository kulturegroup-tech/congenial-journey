# Paradigm Shifters — recruitment workspace

Internal app for Paradigm Shifters: one candidate database, mandate tracker, duplicate guard and billing, replacing Odoo and the sheets. Next.js 16 on Netlify, Supabase for the database and sign-in.

Building with Claude Code? Start with `CLAUDE.md`.

| | |
| --- | --- |
| Live site | https://paradigm-shifters.netlify.app |
| Netlify site | `paradigm-shifters` (team Kulture) |
| Supabase project | `paradigm-shifters`, ref `fqsqfxshjedljagxytat`, region Mumbai (`ap-south-1`) |

## Setup status

- [x] Supabase project created; migrations 1–3 and `seed.sql` applied; security advisor checked
- [x] Netlify site created with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_EMAIL_DOMAINS`
- [ ] Netlify: link the GitHub repo (Project configuration → Build & deploy → Link repository), branch `main`
- [ ] Supabase → Authentication → URL Configuration: Site URL `https://paradigm-shifters.netlify.app`; Redirect URLs `https://paradigm-shifters.netlify.app/auth/callback` and `http://localhost:3000/auth/callback`
- [ ] Supabase → Authentication → Providers → Google (optional; email sign-in links work without it). Needs a Google Cloud OAuth client of type "Web application" with redirect URI `https://fqsqfxshjedljagxytat.supabase.co/auth/v1/callback`
- [ ] First admin added (below)

## Environment variables

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fqsqfxshjedljagxytat.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key |
| `ALLOWED_EMAIL_DOMAINS` | `paradigmshifters.in` |
| `ALLOWED_EMAILS` | extra people allowed to sign in, comma-separated (e.g. the developer) |
| `NEXT_PUBLIC_GOOGLE_SIGNIN` | `on` once Google is enabled in Supabase; until then the Google button is hidden |

Netlify reads these at build time: after changing one, trigger a new deploy.

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
- Remove: run `supabase/demo/remove_demo_data.sql`. **Do this before importing real data.** Real rows are never touched
- Check both: `node supabase/tests/demo.test.mjs`

Demo data is currently **loaded** in the live project.

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

- Sign-in with Google or an email link, limited to the team
- **Lookup** (⌘K): paste a LinkedIn URL, phone (any format), email or name
- **Mandates**: open mandates with owner, counts and stale flags
- **Reminders**: calls, follow-ups, stale mandates, invoices, payments

Next in phase 1: candidates, screening call form, clients and agreements, mandate pipeline, CV share with duplicate check, re-engagement panel, Odoo import. See `CLAUDE.md`.
