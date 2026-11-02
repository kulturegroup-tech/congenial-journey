# Paradigm Shifters — recruitment platform

Internal web app for Paradigm Shifters, a legal recruitment firm in Navi Mumbai that places lawyers into law firms. It replaces Odoo and their scattered sheets with one system. Three users: Khyati (founder, admin), Kopal and Harshit. All three see everything. Desktop-first.

The full spec is the "Paradigm Shifters — Recruitment Platform Build Spec" doc. This file is what you need while coding.

## Stack

- Next.js 16 (App Router, TypeScript) on Vercel, deployed from GitHub on every push to `main`
- Supabase: Postgres, Auth (Google sign-in + email links), Storage (private buckets), cron + edge functions
- Tailwind v4. Design tokens live in `app/globals.css`; shared UI in `components/ui.tsx`, so a design pass touches two files
- Claude API for the agents in phase 3 (not before)

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser-safe), `ALLOWED_EMAIL_DOMAINS`, `ALLOWED_EMAILS`. `SUPABASE_SERVICE_ROLE_KEY` is for import scripts only, never client code. See `.env.example`.

### Next.js 16 is different from what you remember. Read `AGENTS.md` first.

- Docs for this exact version are in `node_modules/next/dist/docs/`. Check them before using any Next API.
- Middleware is now `proxy.ts` (exported `proxy` function). Ours refreshes the Supabase session and sends signed-out visitors to `/login`.
- Cache Components is on. Any Server Component that reads cookies (that is, anything calling `createClient()` from `lib/supabase/server.ts`) must render inside a `<Suspense>` boundary, or the build fails. The pattern used everywhere: a static page header, then `<Suspense fallback={<TableSkeleton />}><DataPart /></Suspense>`.
- `params`, `searchParams`, `cookies()` and `headers()` are async.

### App layout

- `proxy.ts`: session refresh and the sign-in redirect
- `lib/supabase/{env,client,server}.ts`: Supabase clients. Browser client for Client Components, server client for everything else
- `lib/auth/member.ts`: `getSession()` (signed out / not on team / member) and `getTeamNames()`, cached per request
- `lib/auth/allowed.ts`: who may sign in. Checked in `app/auth/callback/route.ts`
- `lib/format.ts`: dates in India time, lakhs, rupees, phones, PQE
- `app/(app)/layout.tsx`: sidebar, plus `TeamGate`, which shows setup, "not on team" or the page
- `app/(app)/<section>/page.tsx`: one folder per nav item. Lookup is a Client Component calling `rpc('lookup')`

## The database is the source of truth for business rules

Schema: `supabase/migrations/`. Seed: `supabase/seed.sql`. Tests: `supabase/tests/rules.test.mjs`.

The rules live in Postgres functions and triggers, so the UI never re-implements them. Call them; don't copy their logic into TypeScript.

| Need | Use |
| --- | --- |
| "Do we have this person?" search | `rpc('lookup', { q })`: matches LinkedIn URL, phone (any format), email, name (fuzzy), firm |
| Show duplicate warnings before sharing a CV | `rpc('check_duplicate', { p_candidate, p_client })` |
| Share a CV | `insert into cv_shares`. The trigger re-runs the duplicate check and raises `DUPLICATE_BLOCKED` (detail = findings JSON). Show the findings; to share anyway, retry with `override_reason` filled in |
| Re-engagement list for a mandate | `rpc('match_candidates_for_mandate', { p_mandate })`. Alerts are written to `notifications` automatically when a mandate is created or set back to active |
| Raise an invoice | `rpc('create_invoice', { p_placement })`: fee, GST split, numbering, deadline and due date are all computed |
| Merge two candidate records | `rpc('merge_candidates', { p_keep, p_drop })` (admin only) |
| Candidate list with PQE, seniority, phones | `v_candidates` |
| Mandate tracker with counts and stale flag | `v_mandate_board` |
| CVs whose validity window is still open | `v_live_submissions` |
| Everything that needs attention | `v_reminders` (kind, recipient, due date, title, links) |

Triggers you should know about:

- Moving a pipeline entry to `cv_shared` or later is refused unless a `cv_shares` row exists. Always go through the share dialog.
- A finished screening call copies city, notice period and CTC onto the candidate, and moves the entry from `mapped` to `called`.
- A placement fills its fee % from the client's agreement (by role category) and sets the replacement window. `joined` moves the pipeline to `joined`. `backed_out` exits the entry. `left_in_window` opens a linked replacement mandate with no fee.
- Stage, status, exit and owner changes are written to `activities`, which also keeps `mandates.last_activity_at` fresh.

Never edit a migration that has been applied. Add a new one, then run `node supabase/tests/rules.test.mjs` (needs `npm i -D @electric-sql/pglite@0.2.17`). Add a test for every new rule.

## Domain glossary

- **Mandate**: a client's open role (e.g. JSA Bengaluru, TMT, 2–4 PQE). Status: active, on hold, filled, lost. Reopening means setting it back to active; that counts in `reopened_count` and re-runs re-engagement.
- **PQE**: post-qualification experience, in years. Store `practice_start_date` only; PQE is always computed as of today with `pqe_years()`. Seniority bands: newly qualified (<1), junior (1–3), mid-level (3–6), senior (6+). Clients often state levels as firm grades (A1–A3, SA): keep their words in `grade_label`, and use `firm_grades` to map them to years.
- **Pipeline stages**, in order: mapped, called, pitched, confirmed (CV received), cv_shared, interview, assignment, final_round, offer, documents, doj_fixed, joined. Leaving at any stage needs an `exit_reason`. "Asked for time" is an exit that needs a `follow_up_on` date and shows up in reminders.
- **Duplicate**: the candidate's CV already reached the client by any route (another agency, job portal, client website, direct email to anyone at the firm) inside the client's **cooling-off period** (from the agreement; default 6 months). Recorded as `prior_applications`, captured from screening-call field 12.
- **Resume validity**: a CV we share stays "ours" at that client for the agreement's validity period (usually 12 months). If they hire the candidate inside it, the fee is due.
- **Replacement**: one-time, usually 3 months from joining. The standard letter excludes leaving for medical reasons.
- **Fee**: agreement % × annual fixed salary (mostly 10%; some 6% or 13%; Trilegal pays 9% for support staff). GST 18% on top: CGST + SGST when the client's GSTIN starts with 27 (Maharashtra), IGST otherwise.
- **Invoice deadline**: some agreements forfeit the fee if the invoice isn't raised within N days of joining (Trilegal: 30). Payment terms count from the invoice date or from joining, depending on the agreement.
- **Interest tags**: firms, cities and roles a candidate wants (screening-call field 5). They drive re-engagement, the top-priority feature.

## Data conventions

- Money: INR rupees as `numeric`, annual. Display in lakhs ("21 L", "2.1 L") and Indian grouping (2,47,800).
- Dates: India time. In SQL use `today_ist()`, never `current_date`. Show "02 Nov 2026".
- Phones: stored E.164 (`+919000000001`), one person per number. Use `normalize_phones()` on input.
- LinkedIn: store the URL; `linkedin_slug` is generated and unique.
- Firms: one row per organisation, with `aliases` ("AZB" / "AZB & Partners"). Match typed firm names against name and aliases before creating a new firm.
- Practice areas: pick from the `practice_areas` table, never free text.
- Files: private buckets only (`candidate-files`, `agreements`, `invoices`), opened through signed URLs.

## Phase 1 scope (weeks 1–3): replace the sheets

Build in this order. Each step should be usable on its own.

- [x] Auth: Google sign-in or an email link through Supabase; only allowed domains or emails get in. A user without a `team_members` row sees nothing (RLS). First admin: see README
- [x] App shell: left nav (Lookup, Mandates, Candidates, Clients, Reminders, Settings), Cmd/Ctrl+K opens Lookup
- [x] Lookup: paste anything, see the match at once with phones and last call (who, when)
- [x] Mandates board (read-only) and Reminders list
- [ ] Notification bell for re-engagement alerts; "Create candidate" from an empty lookup; current pipelines in lookup results
- [ ] Candidates: list (search, filter by practice area, city, PQE range, seniority, firm) and profile (contacts, CVs, calls, interest tags, prior applications, pipelines, activity)
- [ ] Screening call form: the 14 fields, plus structured interest tags (field 5) and prior applications (field 12) captured in the same form. Must be fast to fill during a call
- [ ] Clients and agreements: client, contacts (flag who is copied on shares), agreement terms and fee rates, signed PDF upload
- [ ] Mandates: board from `v_mandate_board` (stale ones highlighted), mandate page with intake fields and a pipeline kanban; dragging into an exit asks for the reason
- [ ] CV share dialog: pick CV version and channels, show `check_duplicate` findings, block or ask for an override reason, then open WhatsApp (`wa.me` link) or email with the note filled in. Copy the TA team when the agreement says so
- [ ] Re-engagement: a "Past candidates who fit" panel on each mandate, plus notifications
- [ ] Import (admin): load Odoo and sheet rows into `import_rows`, normalise, auto-merge on phone, email or LinkedIn, and send near-matches and unreadable PQE to a review list

Phase 2 (don't build yet): placements, invoices and PDF, payments, reminders screen and emails, replacement windows, Google Calendar sync, dashboard. Phase 3: AI agents.

## Odoo and sheet import

- Odoo export columns: Applicant's Name, Applied on, Job Position, Stage, Recruiter, Phone Number (empty in the current export), Last Updated by, Last Updated on, Kanban Ongoing, LinkedIn Profile.
- Job Position strings combine level, client, practice and city ("A1-A3 AP & Partners GC Delhi/Ggn"). Split them into mandates by hand-checked mapping (about 110).
- Recruiter appears as a full name, an email or a first name; map all three to team members.
- Stage mapping: Yet to speak → mapped; Relevant → called; Awaiting Candidate Feedback / Awaiting CV → pitched; CV Received → confirmed; Shared Profiles → cv_shared; Interviewed → interview; Advanced Interview → final_round; Offer Made → offer; Offer Accepted → documents; Billed and Closed → joined. Exits: Not Interested → rejected_role; Rejected → client_rejected_cv; Duplicate → duplicate; Not relevant but interested → not_a_fit, plus interest tags.
- Sheets: one tab per role, and the columns differ per tab (Name, Firm Name, PQE, LinkedIn, Contact Number, Interested, Status, Comments, Last date of update, Recruiter, On Odoo). PQE is years.months ("5.11") or "6y 1m": use `parse_sheet_pqe()`. Dates are mixed and sometimes have day and month swapped; flag any future date for review.
- Imports set `app.bypass_guards = on` for the transaction so historic stages can be loaded without share records.

## Guardrails

- **LinkedIn: no automation of any kind.** No scraping, auto-messaging or browser bots. Khyati's account has been blocked before. Store URLs only.
- Candidate data is personal data under India's DPDP Act, and client agreements make candidate pay and submissions confidential. Never log personal data to the console or analytics. Never send it to any third-party service except the Claude API in phase 3.
- RLS stays on for every table. Never use the service role key in the browser.
- Only admins delete. Prefer status changes and exits over deletes.
- Never commit real candidate data, CVs, GSTINs or bank details. Tests use fake data.

## UI principles

- Desktop-first and dense: tables over cards, keyboard shortcuts, no page reloads for common actions.
- Speed matters most on Lookup and the screening call form; those are used while on the phone.
- Every list answers "who owns this and when did anything last happen".
- Visual design is decided separately. Keep tokens (colours, type, spacing) in one place.
