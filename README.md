# Paradigm Shifters — recruitment workspace

Internal app for Paradigm Shifters: one candidate database, mandate tracker, duplicate guard and billing, replacing Odoo and the sheets. Next.js 16 on Vercel, Supabase for the database and sign-in.

Building with Claude Code? Start with `CLAUDE.md`.

## First-time setup

### 1. Supabase

1. Create a project at supabase.com (region: Mumbai, `ap-south-1`).
2. Run the schema. Either:
   - with the Supabase CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`, then run `supabase/seed.sql` in the SQL editor; or
   - in the SQL editor, paste and run, in order: `supabase/migrations/20261102000001_init.sql`, `supabase/migrations/20261102000002_storage.sql`, `supabase/seed.sql`.
3. **Authentication → URL Configuration**: set Site URL to the Vercel address, and add these Redirect URLs:
   - `https://<your-vercel-domain>/auth/callback`
   - `http://localhost:3000/auth/callback`
4. **Authentication → Providers → Google**: turn it on with a Google Cloud OAuth client (type "Web application"). In Google Cloud, the authorised redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
   Email sign-in links work without this, so you can test before Google is set up.

### 2. Vercel

1. vercel.com/new → Import `kulturegroup-tech/paradigm-shifters`. Framework: Next.js (detected).
2. Environment variables (from Supabase → Project Settings → API):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable (or anon) key |
   | `ALLOWED_EMAIL_DOMAINS` | `paradigmshifters.in` |
   | `ALLOWED_EMAILS` | extra people allowed to sign in, comma-separated (e.g. the developer) |

3. Deploy. Every push to `main` deploys again.

Without the Supabase variables the site still deploys and shows a "Connect the database" screen.

### 3. Add the team

Each person signs in once (this creates their login), then an admin adds them. The first admin goes in through the Supabase SQL editor:

```sql
insert into team_members (id, full_name, email, is_admin)
select id, 'Khyati Shrestha', email, true from auth.users where email = 'khyati@paradigmshifters.in';
```

Until someone has a `team_members` row, they see an "Almost there" screen and no data.

## Local development

```bash
cp .env.example .env.local   # fill in the Supabase values
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
