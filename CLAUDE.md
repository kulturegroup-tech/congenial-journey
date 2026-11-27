# Paradigm Shifters — recruitment platform

Internal web app for Paradigm Shifters, a legal recruitment firm in Navi Mumbai that places lawyers into law firms. It replaces Odoo and their scattered sheets with one system. Three users: Khyati (founder, admin), Kumar and Kopal. All three see everything. Desktop-first.

The full spec is the "Paradigm Shifters — Recruitment Platform Build Spec" doc. This file is what you need while coding.

## Stack

- The product is **Covaro**. Deployments of this one repo, each redeploying on every push to `main`:
  - **Paradigm Shifters (live, real data):** Render web service (Starter, Singapore, always on), https://paradigm-shifters.onrender.com (its settings are in `render.yaml`) → Supabase project `paradigm-shifters-live` (ref `jrpekdeeyzlbmyghwlta`, Mumbai). Team: Khyati (admin), Kumar, Kopal. The old Vercel copy (`paradigmshifters.vercel.app`, team kulture4) points at the same database and is to be deleted.
  - **Ankit Mahajan's trial (Magic Circle Partners, real data):** Vercel project `covaro-demo`, https://covaro-app.vercel.app → Supabase project `paradigm-shifters` (ref `fqsqfxshjedljagxytat`). It was the demo; since 26 Nov 2026 it holds Ankit's own candidates (he is admin), so never demo it to anyone else, never reset it, and treat it like live data. A new demo needs a new project.
  - Migrations 1–15 are applied on the live project. The demo has all but 9 (keep-awake, live-only, and switched off again by 11). Apply new migrations to **both**, live first, in order, **before** pushing code that needs them: every push redeploys every copy.
  - A new firm gets its own Supabase project and Render service: `docs/new-firm-setup.md`. Add each one to this list.
  - Demo data: `npm run -s demo:reset-sql` loads `supabase/demo/` into a demo project (paste into its SQL editor); it refuses to run where there's no demo data. Not for Ankit's trial.
  - The old Netlify site is no longer used
- Supabase: Postgres, Auth (Google sign-in + email links), Storage (private buckets), cron + edge functions
- Tailwind v4. Design tokens live in `app/globals.css`; shared UI in `components/ui.tsx` and `components/form.tsx`, so a design pass touches three files
- Claude API (Anthropic): the CV reader now (`lib/ai/cv-reader.ts`, plain `fetch`, the firm's own `ANTHROPIC_API_KEY`, model `ANTHROPIC_MODEL`, default `claude-haiku-5-5`); the agents in phase 3. Never use any other Anthropic credentials or base URL

Product name: `lib/brand.ts` reads `NEXT_PUBLIC_BRAND_NAME` (badge `NEXT_PUBLIC_BRAND_SHORT`, sign-in line `NEXT_PUBLIC_BRAND_PLACE`, "-" hides it), default Covaro. The firm's own name (invoices, the signature on CV share notes) is `settings.firm_name`. Never hard-code either; use `BRAND_NAME`.

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
- `app/(app)/layout.tsx`: sidebar, plus `TeamGate`, which shows setup, "not on team" or the page, all inside `components/providers.tsx` (toasts, right-click menus, the ⌘K palette, the "Log a call" button)
- `app/(app)/today`: the home screen. The line under the greeting comes from `lib/day-line.ts` (picked from the person's own day, most important first); the illustration beside it from `lib/moments.ts` + `components/illustrations.tsx` (festivals, someone joining, target hit, month end, heavy rain; most days nothing). Add next year's festival dates to `FESTIVALS` each November. Tests: `npm run test:app`
- `app/(app)/calendar`: day, week and month views of calls, interviews, follow-ups, joinings and payments
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

Supabase runs API calls with safeupdate on: an `UPDATE` or `DELETE` without `WHERE` fails at runtime ("UPDATE requires a WHERE clause"), even inside a function, and PGlite won't catch it. Always write a `WHERE` (`where id` for the one-row `settings`); the tests check every function. Wrap helpers in policies as `(select is_team_member())` so they run once per query; the tests check that too.

## Domain glossary

- **Mandate**: a client's open role (e.g. JSA Bengaluru, TMT, 2–4 PQE). It can have several practice areas: `mandates.practice_areas` (in order); `practice_area` is kept as the first by a trigger, so imports can still set just one. Re-engagement counts a fit on any of them. `mandates.contact_ids` names the client's contacts (POCs) the role is with, first = main: a trigger allows only that client's contacts, and the CV share goes to the main one with the others copied. Status: active, on hold, filled, lost. Reopening means setting it back to active; that counts in `reopened_count` and re-runs re-engagement.
- **PQE**: post-qualification experience, in years. Store `practice_start_date` only; PQE is always computed as of today with `pqe_years()`. Seniority bands: newly qualified (<1), junior (1–3), mid-level (3–6), senior (6+). Clients often state levels as firm grades (A1–A3, SA): keep their words in `grade_label`, and use `firm_grades` to map them to years.
- **Pipeline stages**, in order: mapped, called, pitched, confirmed (CV received), cv_shared, interview, assignment, final_round, offer, documents, doj_fixed, joined. Leaving at any stage needs an `exit_reason`. "Asked for time" is an exit that needs a `follow_up_on` date and shows up in reminders.
- **Duplicate**: the candidate's CV already reached the client by any route (another agency, job portal, client website, direct email to anyone at the firm) inside the client's **cooling-off period** (from the agreement; default 6 months). Recorded as `prior_applications`, captured from screening-call field 12.
- **Resume validity**: a CV we share stays "ours" at that client for the agreement's validity period (usually 12 months). If they hire the candidate inside it, the fee is due.
- **Replacement**: one-time, usually 3 months from joining. The standard letter excludes leaving for medical reasons.
- **Fee**: agreement % × annual fixed salary, where annual = monthly fixed × 12. Bonuses and ESOPs never count. The team enters the monthly figure; the app stores the annual (mostly 10%; some 6% or 13%; Trilegal pays 9% for support staff). GST 18% on top: CGST + SGST when the client's GSTIN starts with 27 (Maharashtra), IGST otherwise.
- **Invoices**: raised on the joining day. Numbered `PS/2026-27/014`; the series restarts at 001 every 1 April (`financial_year()`, `settings.invoice_fy`).
- **Invoice deadline**: some agreements forfeit the fee if the invoice isn't raised within N days of joining (Trilegal: 30). Payment terms count from the invoice date or from joining, depending on the agreement.
- **Interest tags**: firms, cities and roles a candidate wants (screening-call field 5). They drive re-engagement, the top-priority feature.

## Confirmed with Khyati (04 Nov 2026)

- Invoice series resets every financial year; bill on joining day; fee on monthly fixed × 12, no bonus or ESOPs
- Everyone sees money (fees, invoices): they track their targets
- Stale mandate after 5 working days; re-engagement alerts go to whoever last spoke to the candidate, else the mandate owner; the 12 pipeline stages are right
- Sharing past a duplicate block: pick a reason from a list (`OVERRIDE_REASONS` in the share dialog) plus a note
- Replacement terms differ by client: set them in the agreement while creating the client
- Firm grades in use: A0–A5 and SA1–SA5 (year mapping still to confirm)
- Still open: the default cooling-off / CV validity when a client has no agreement (6 / 12 months for now), CTC in the share note, invoice number format, everything in the call list not answered yet

## Data conventions

- Money: INR rupees as `numeric`, annual. Display in lakhs ("21 L", "2.1 L") and Indian grouping (2,47,800).
- Dates: India time. In SQL use `today_ist()`, never `current_date`. Show "02 Nov 2026".
- Phones: stored E.164 (`+919000000001`), one person per number. Use `normalize_phones()` on input.
- LinkedIn: store the URL; `linkedin_slug` is generated and unique.
- Firms: one row per organisation, with `aliases` ("AZB" / "AZB & Partners"). Match typed firm names against name and aliases before creating a new firm.
- Practice areas: pick from the `practice_areas` table, never free text. Khyati's list (99 areas, migration 10), each in a `category` for the pickers: `PracticeOptions` (grouped `<option>`s) and `PracticePicker` (search + tick, several) in `components/practice.tsx`. The older broad areas are `active = false`; records that use one keep it, and the pickers still show it on them.
- Candidate notes: `candidates.notes` is one big free-text box per candidate for pasted call records, edited on the profile (`app/(app)/candidates/[id]/notes.tsx`). Saves check `notes_updated_at`, so a teammate's save is never overwritten. The call form shows earlier calls and these notes beside it.
- Files: private buckets only (`candidate-files`, `agreements`, `invoices`), opened through signed URLs.
- CV reader: Candidates → CV inbox (`app/(app)/candidates/inbox`). The browser uploads to `candidate-files/inbox/<uuid>.<ext>` and adds a `cv_inbox` row; `POST /api/cv-inbox/read` (a route, so three can run at once) sends the PDF, or the text of a `.docx` (`mammoth`), to Claude with a forced tool call, and `tidyExtract` in `lib/cv-extract.ts` throws out anything off the list. The team checks it on `/candidates/new?inbox=<id>` (the CV beside the form, likely duplicates with "Add this CV to them"); saving files the CV via `fileInboxCv`. The file keeps its inbox path. Off until an admin turns on `settings.ai_cv_reading`; `CV_READER_FAKE=1` pretends locally. Never record date of birth, age, gender, religion, caste, marital status, family or health from a CV (the prompt says so; keep it).
- Highlights: `candidates.highlights`, 3 or 4 lines (one per line) from the CV reader or typed, shown on the profile and edited on the candidate form.
- Cover page: "Add our cover page" in Share CV (remembered per browser; "Show CTC and notice period" always starts off). `lib/cover-pdf.ts` (pdf-lib, no app imports, tests in `tests/cover.test.mjs`) draws one page from the firm's logo, the candidate's role, PQE, city, practice areas and highlights, and puts it in front of the CV's own pages; Word or locked CVs get the cover on its own. Built in the browser (`app/(app)/mandates/[id]/cover.ts`), so the CV never leaves the computer. No phone or email on it, and nothing names Covaro: it's the firm's document. The logo is uploaded by an admin in Settings to the private `branding` bucket (`settings.logo_path`); never hard-code one. The serif is `public/fonts/InstrumentSerif-Regular.ttf` (OFL; pdf-lib can't embed the app's woff2).

## Phase 1 scope (weeks 1–3): replace the sheets

Build in this order. Each step should be usable on its own.

- [x] Auth: Google sign-in or an email link through Supabase; only allowed domains or emails get in. A user without a `team_members` row sees nothing (RLS). First admin: see README
- [x] App shell: left nav (Lookup, Mandates, Candidates, Clients, Billing, Reminders, Settings), Cmd/Ctrl+K opens Lookup
- [x] Lookup: paste anything, see the match at once with phones and last call (who, when)
- [x] Mandates board (read-only) and Reminders list
- [x] Notification bell for re-engagement alerts; "Create candidate" from an empty lookup; current pipelines in lookup results
- [x] Candidates: list (search, filter by practice area, city, PQE range, seniority, firm) and profile (contacts, CVs, calls, interest tags, prior applications, pipelines, activity)
- [x] Screening call form: the 14 fields, plus structured interest tags (field 5) and prior applications (field 12) captured in the same form. Must be fast to fill during a call
- [x] Clients and agreements: client, contacts (flag who is copied on shares), agreement terms and fee rates, signed PDF upload
- [x] Mandates: board from `v_mandate_board` (stale ones highlighted), mandate page with intake fields and a pipeline kanban; dragging into an exit asks for the reason
- [x] CV share dialog: pick CV version and channels, show `check_duplicate` findings, block or ask for an override reason, then open WhatsApp (`wa.me` link) or email with the note filled in. Copy the TA team when the agreement says so
- [x] Re-engagement: a "Past candidates who fit" panel on each mandate, plus notifications
- [x] Import (admin): load Odoo and sheet rows (CSV or Excel `.xlsx`, one tab at a time, read in the browser with `exceljs`) into `import_rows`, normalise, auto-merge on phone, email or LinkedIn, and send near-matches and unreadable PQE to a review list

Built ahead of phase 2: placements (from "Offer accepted" on a pipeline card, status updates on Billing), invoices via `create_invoice` with a printable tax invoice (browser print to PDF), payments, team management with PINs in Settings.

Ankit's list (26 Nov 2026), in order: (1) client contacts on mandates + Excel import, done; (2) CV reader, single and bulk, editable details, AI highlights, done; (3) a one-page branded cover put before the original CV when sharing, behind a tick box, done; (4) a client portal: link plus one-time code per contact, the CVs shared with that client, feedback, Excel export.

Phase 2 (still to do): invoice PDF stored in the `invoices` bucket, reminder emails, Google Calendar sync, dashboard. Phase 3: AI agents.

### Where things live in the app

- `app/(app)/<section>/actions.ts`: Server Actions for that section. They call the database and then `refreshAll()` from `lib/refresh.ts`, never `refresh()` alone: plain `refresh()` left pages fetched ahead on hover showing data from before the save (a candidate added to a mandate didn't show until a reload). Business rules stay in Postgres
- `components/fresh-on-return.tsx`: coming back to a tab after 15 s away re-reads the data on screen, so another tab's or a teammate's change shows without a reload
- `lib/forms.ts` (reading FormData, `dbError`), `components/form.tsx` (inputs, `Dialog`, `SubmitButton`), `lib/data/options.ts` (cached lists for selects)
- Inserts into `cv_shares` and `placements` pass placeholder ids for `candidate_id`, `client_id`, `mandate_id` (and `valid_until`); the BEFORE triggers fill them from the pipeline entry

## Odoo and sheet import

- Odoo export columns: Applicant's Name, Applied on, Job Position, Stage, Recruiter, Phone Number (empty in the current export), Last Updated by, Last Updated on, Kanban Ongoing, LinkedIn Profile.
- Job Position strings combine level, client, practice and city ("A1-A3 AP & Partners GC Delhi/Ggn"). Split them into mandates by hand-checked mapping (about 110).
- Recruiter appears as a full name, an email or a first name; map all three to team members.
- Stage mapping: Yet to speak → mapped; Relevant → called; Awaiting Candidate Feedback / Awaiting CV → pitched; CV Received → confirmed; Shared Profiles → cv_shared; Interviewed → interview; Advanced Interview → final_round; Offer Made → offer; Offer Accepted → documents; Billed and Closed → joined. Exits: Not Interested → rejected_role; Rejected → client_rejected_cv; Duplicate → duplicate; Not relevant but interested → not_a_fit, plus interest tags.
- Sheets: one tab per role, and the columns differ per tab (Name, Firm Name, PQE, LinkedIn, Contact Number, Interested, Status, Comments, Last date of update, Recruiter, On Odoo). PQE is years.months ("5.11") or "6y 1m": use `parse_sheet_pqe()`. Dates are mixed and sometimes have day and month swapped; flag any future date for review.
- Imports set `app.bypass_guards = on` for the transaction so historic stages can be loaded without share records.

## Guardrails

- **LinkedIn: no automation of any kind.** No scraping, auto-messaging or browser bots. Khyati's account has been blocked before. Store URLs only.
- Candidate data is personal data under India's DPDP Act, and client agreements make candidate pay and submissions confidential. Never log personal data to the console or analytics. Never send it to any third-party service except the Claude API (the CV reader, and the agents in phase 3), and only once the firm's admin has switched it on.
- Keep-awake: migration 9 scheduled `pg_cron` + `pg_net` to open `/warm` every 5 minutes so Vercel's free plan didn't sleep; migration 11 switched it off, because Render's Starter plan never sleeps. `/warm` (`app/warm/page.tsx`, public in `proxy.ts`) stays as Render's health check. It reads nothing.
- The only other outside call is the Mumbai weather check (`lib/weather.ts`, MET Norway, June to mid-October, cached hourly). It sends a city's coordinates and nothing else; keep it that way.
- RLS stays on for every table. Never use the service role key in the browser.
- Only admins delete. Prefer status changes and exits over deletes.
- Never commit real candidate data, CVs, GSTINs or bank details. Tests use fake data.

## UI principles

- Desktop-first and dense: tables over cards, keyboard shortcuts, no page reloads for common actions.
- Speed matters most on Lookup and the screening call form; those are used while on the phone.
- Every list answers "who owns this and when did anything last happen".
- Links: import `Link` from `@/components/fast-link`, never `next/link`. It fetches the whole page (data included) once the pointer rests on a link, so the click opens it at once. Don't add `prefetch={true}` to links: that would render every visible page on the server on each load (the free plan's CPU can't take it), which is also why `partialPrefetching` stays off.
- Every click shows it was heard: a top bar on page changes (`components/nav-progress.tsx`; call `navigateTo()` instead of `router.push`), "Saving…" on buttons, and an error in words when something fails (`dbError` in `lib/forms.ts`). Never ignore what an action returns.
- Salaries are typed loosely ("24", "24 L", "2.4 Cr", "24,00,000"): read them with `parseRupees` / `lakhs` / `monthlyToAnnual` and check `moneyProblem` first. Open private files with `openFile()` so Safari doesn't block the tab.
- Plain words on screen: "Yet to speak", "Spoke", "Going quiet", "Drop", "Find someone". Stage keys in the database stay as they are; labels live in `lib/constants.ts`. The board groups the 12 stages into three phases: Talking to them, With the client, Closing.

### Design system (Forest & sage)

- Tokens in `app/globals.css`: forest `accent` #24453a on white `surface` and `canvas` #f4f6f3; tile tones `mist`, `clay`, `sand`, `sage`, `lilac`, `accent-soft`. Headings in Instrument Serif (`font-display`), everything else in the system sans.
- Use the parts, don't restyle by hand: `PageHeader`, `Tile` (coloured block with a title), `Card`, `Table`, `Empty`, `Avatar`, `Badge` from `components/ui.tsx`; `Button` variants primary / secondary / outline / ghost / danger and the bottom-sheet `Dialog` from `components/form.tsx`.
- Interaction rules: quiet hovers (the `.state` layer, never glows or gradients), except buttons, which fill in from the left (`.btn-fill`, set by `Button`/`ButtonLink`/`SubmitButton`; give hand-made buttons `btn-fill` and `data-variant`); a row that opens a page is clickable anywhere (`RowLink` from `components/row-link.tsx`, or `PersonRow` with `href`; add an empty `""` to the table's `head` for its arrow column); actions on a row appear on hover in place of its secondary text (`.swap`); every person row has a right-click menu (`PersonRow`); anything reversible shows a toast with Undo (`useToast`) instead of a confirm dialog; ⌘K does both search and actions; confetti only when someone joins; Today's illustrations play once a day and then sit still.
- Motion uses `var(--ease-spring)` and respects reduced motion.
- Looks: light (default) and dark ("Forest dusk"), picked per computer in Settings → Appearance (System / Light / Dark, `components/theme.tsx`, saved in localStorage). `THEME_SCRIPT` (`lib/theme.ts`, inlined in `app/layout.tsx`) sets `html[data-theme]` before the first paint. The dark tokens live in `app/globals.css` under `[data-theme="dark"]`, screen only, so printing is always light. The sidebar is dark forest in both looks (`.forest-side`, tokens scoped to it, so the bell panel matches it). Documents stay black on white with `.paper` (the tax invoice). `bg-white` is a card colour and follows the look; white text on the forest hero is `text-on-hero`. Don't hard-code hex colours in components: use tokens, or a `dark:` variant when a colour must differ (avatars keep their pastel with fixed dark initials).
