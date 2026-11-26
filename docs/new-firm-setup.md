# Setting up Covaro for a new firm

Each firm gets its own copy: its own Supabase project (database, sign-in, files) and its own Render
web service, both from this one repo. Nothing is shared between firms, which is the first thing a
recruitment firm will ask about. Allow about an hour.

**Running cost per firm:** about $17 a month: Render Starter $7, plus $10 for one more Micro project
in the Supabase Pro organisation. Build it into the yearly AMC.

## Before you start

- The firm's name, office city, GSTIN, billing address and bank details (for invoices)
- Their email domain (for example `abclegal.in`), and who should be admin
- A name for the address, for example `abc-legal` → `https://abc-legal.onrender.com`

## 1. Database (Supabase)

1. In the Kulture Supabase organisation (Pro): **New project**, region **Mumbai (ap-south-1)**.
   Save the database password somewhere safe.
2. Apply every file in `supabase/migrations/` in order. Either ask Claude ("apply the migrations to
   project `<ref>`"), or with the Supabase CLI: `supabase link --project-ref <ref>` then
   `supabase db push`. (Migration 9 schedules a keep-awake ping and 11 removes it again; that's fine.)
3. Run `supabase/seed.sql` in the SQL editor. It fills the exit reasons and a settings row; the
   firm details in it are Paradigm Shifters' and get replaced in step 4.
4. Authentication → URL Configuration: **Site URL** `https://<name>.onrender.com`, and add
   `https://<name>.onrender.com/auth/callback` to Redirect URLs.
5. Copy the project URL and the **publishable** key (Project Settings → API Keys). Never use the
   service role key in the app.

## 2. App (Render)

1. Render → New → **Web Service** → the `kulturegroup-tech/congenial-journey` repo, branch `main`.
2. Copy the settings from `render.yaml`: Node, region **Singapore**, plan **Starter**,
   build `npm ci && npm run build`, start `npm start`, health check path `/warm`.
3. Environment variables:

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NEXT_TELEMETRY_DISABLED` | `1` |
| `NEXT_PUBLIC_SUPABASE_URL` | the new project's URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the new project's publishable key |
| `ALLOWED_EMAIL_DOMAINS` | the firm's email domain |
| `NEXT_PUBLIC_BRAND_PLACE` | their city for the sign-in page, or `-` to hide it |
| `ANTHROPIC_API_KEY` | optional: their Claude API key, for the CV reader. Mark it secret |

4. Deploy. The sign-in page should say Covaro.

## 3. First admin and the team

1. Supabase → Authentication → Users → **Add user** → their email, a 6–12 digit PIN as the
   password, tick **Auto confirm**.
2. SQL editor, so they are on the team as admin:

```sql
insert into team_members (id, full_name, email, is_admin)
select id, '<Full Name>', email, true from auth.users where email = '<their email>';
```

3. From then on the admin adds everyone else in the app: **Settings → Team → Add member**.
   Give PINs on a call, not by email.

## 4. Their details (in the app, Settings)

- Firm name, address, GSTIN (its first two digits set the tax split: same-state clients get
  CGST + SGST, others IGST), bank details
- Invoice prefix (their initials) and **next invoice number 1**
- Monthly joinings target, when a mandate goes quiet, default cooling-off and CV validity
- Practice areas: the 99 come with migration 10; add or hide what they don't use
- Reading CVs with AI: off until their admin turns it on (and `ANTHROPIC_API_KEY` is set). Ask them first:
  each CV goes to Anthropic's Claude API

## 5. Check before handing over

- [ ] Sign in as the admin, add a test candidate, look them up by phone
- [ ] Add a client with an agreement, open a mandate, put the candidate on it and open Share CV
- [ ] Delete the test candidate and client (admin only), or keep them to show in training
- [ ] Their existing data: import it from Settings → Import

## When you change the code later

Every push to `main` redeploys **every** firm at once. So a change that needs a database update
must be applied to **every firm's Supabase project before** the push, or their app breaks.
Keep the list of firms and their project refs in `CLAUDE.md` (Stack).
