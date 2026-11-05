import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import { PersonRow } from "@/components/context-menu";
import { MomentArt } from "@/components/moment";
import { TitleBar } from "@/components/title-bar";
import { Avatar, Badge, TableSkeleton, Tile } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession, getTeamNames } from "@/lib/auth/member";
import { PHASES } from "@/lib/constants";
import { dayLine, type Seg } from "@/lib/day-line";
import { addDays, ago, daysSince, formatLakhs, formatLongDay, formatTime, greeting, istHour, istStart, minutesUntil, monthEnd, monthName, monthStart, todayIst } from "@/lib/format";
import { pickMoment, workingDaysLeft } from "@/lib/moments";
import { inMumbai } from "@/lib/rain";
import { heavyRainToday } from "@/lib/weather";
import { FindBar, LogCallLink, RowActions, SuggestionShelf } from "./parts";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <>
      <TitleBar title="Today" />
      <Suspense
        fallback={
          <div className="px-10 pt-24">
            <TableSkeleton />
          </div>
        }
      >
        <TodayScreen />
      </Suspense>
    </>
  );
}

async function TodayScreen() {
  const session = await getSession();
  if (session.state !== "member") return null;
  const me = session.member;
  const supabase = await createClient();
  const today = todayIst();
  const mStart = monthStart(today);
  const mEnd = monthEnd(today);

  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const lastLook = [mEnd, addDays(today, 7)].sort()[1];

  const [calls, follows, sugg, quiet, joins, billed, open, settings, mine, team, interviewsQ, invoiceQ, heavyRain] = await Promise.all([
    supabase
      .from("screening_calls")
      .select("id, scheduled_for, mandate_id, candidate_id, candidates(full_name, designation, firms(name), candidate_phones(phone)), mandates(title, clients(display_name))")
      .eq("status", "scheduled")
      .eq("recruiter_id", me.id)
      .gte("scheduled_for", istStart(today))
      .lt("scheduled_for", istStart(addDays(today, 1)))
      .order("scheduled_for"),
    supabase
      .from("pipeline_entries")
      .select("id, follow_up_on, exit_note, candidate_id, mandate_id, candidates(full_name, candidate_phones(phone)), mandates(title, clients(display_name))")
      .eq("owner_id", me.id)
      .lte("follow_up_on", today)
      .or("exited_at.is.null,exit_reason.eq.asked_for_time")
      .order("follow_up_on"),
    supabase
      .from("notifications")
      .select("id, mandate_id, candidate_id, body, created_at, candidates(full_name), mandates(title, city, status, clients(display_name))")
      .eq("recipient_id", me.id)
      .eq("kind", "reengagement")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("v_mandate_board").select("id, client, title, city, owner_id, last_activity_at").eq("is_stale", true).order("last_activity_at").limit(4),
    supabase
      .from("placements")
      .select("id, joining_date, candidate_id, candidates(full_name), clients(display_name)")
      .gte("joining_date", mStart)
      .lte("joining_date", lastLook)
      .neq("status", "backed_out"),
    supabase.from("invoices").select("taxable_amount").gte("invoice_date", mStart).lte("invoice_date", mEnd).neq("status", "cancelled"),
    supabase.from("invoices").select("total, payments(amount)").in("status", ["sent", "part_paid"]),
    supabase.from("settings").select("*").maybeSingle(),
    supabase.from("v_mandate_board").select("id, client, title, city, last_activity_at, is_stale").eq("owner_id", me.id).eq("status", "active").order("last_activity_at", { ascending: false }).limit(6),
    getTeamNames(),
    // Needs migration 7 (interview dates); until then this errors and is treated as none.
    supabase
      .from("pipeline_entries")
      .select("id, stage, interview_at, candidate_id, candidates(full_name), mandates(city, clients(display_name))")
      .eq("owner_id", me.id)
      .is("exit_reason", null)
      .gte("interview_at", istStart(today))
      .lt("interview_at", istStart(addDays(today, 1)))
      .order("interview_at"),
    // Invoices with a deadline in the agreement; the view works the deadline out.
    supabase.from("v_reminders").select("due_on, title, candidate_id, client_id").eq("kind", "invoice_to_raise").eq("recipient_id", me.id).gte("due_on", today).like("title", "%(deadline%").order("due_on").limit(1),
    heavyRainToday(today),
  ]);

  // Phase counts for my mandates.
  const mineIds = (mine.data ?? []).map((m) => m.id!).filter(Boolean);
  const { data: entries } = mineIds.length
    ? await supabase.from("pipeline_entries").select("mandate_id, stage").in("mandate_id", mineIds).is("exit_reason", null)
    : { data: [] as { mandate_id: string; stage: string }[] };
  const phaseCount = (mid: string, i: number) => (entries ?? []).filter((e) => e.mandate_id === mid && (PHASES[i].stages as readonly string[]).includes(e.stage)).length;

  // Suggestions, grouped by mandate, newest first.
  const groups = new Map<string, { name: string; people: { candidate_id: string; name: string; reason: string }[] }>();
  for (const n of sugg.data ?? []) {
    if (!n.mandate_id || !n.candidate_id || n.mandates?.status !== "active") continue;
    const g = groups.get(n.mandate_id) ?? { name: `${n.mandates.clients?.display_name ?? ""}, ${n.mandates.title}`, people: [] };
    if (!g.people.some((p) => p.candidate_id === n.candidate_id))
      g.people.push({ candidate_id: n.candidate_id, name: n.candidates?.full_name ?? "—", reason: (n.body ?? "").split(" · ")[0] ?? "" });
    groups.set(n.mandate_id, g);
  }
  const [first, ...others] = [...groups.entries()];

  const target = (settings.data as { monthly_joining_target?: number } | null)?.monthly_joining_target ?? 5;
  // Joined means the joining date has come; later ones this month show as booked on the bar.
  const monthJoins = (joins.data ?? []).filter((j) => j.joining_date && j.joining_date >= mStart && j.joining_date <= mEnd);
  const joined = monthJoins.filter((j) => j.joining_date! <= today).length;
  const booked = monthJoins.length - joined;
  const billedSum = (billed.data ?? []).reduce((s, i) => s + Number(i.taxable_amount), 0);
  const toCollect = (open.data ?? []).reduce((s, i) => s + Number(i.total) - i.payments.reduce((t, p) => t + Number(p.amount), 0), 0);
  const nCalls = calls.data?.length ?? 0;
  const nFollow = follows.data?.length ?? 0;
  const firstName = me.full_name.split(" ")[0].replace(/\(.*\)/, "").trim();
  // The next call (or one that started in the last half hour) gets the big button.
  const nextCall = (calls.data ?? []).find((c) => c.scheduled_for && minutesUntil(c.scheduled_for) > -30);

  // The line under the greeting and, on days that matter, an illustration beside it.
  const person = (id: string, name: string | null | undefined) => ({ name: name ?? "Someone", href: `/candidates/${id}` });
  const joiningsToday = (joins.data ?? []).filter((j) => j.joining_date === today).map((j) => ({ ...person(j.candidate_id, j.candidates?.full_name), client: j.clients?.display_name ?? "the client" }));
  const interviews = (interviewsQ.error ? [] : (interviewsQ.data ?? [])).filter((i) => i.interview_at && minutesUntil(i.interview_at) > -60);
  const invoice = invoiceQ.data?.[0];
  const [invoiceName, invoiceClient] = invoice
    ? await Promise.all([
        supabase.from("candidates").select("full_name").eq("id", invoice.candidate_id!).maybeSingle(),
        supabase.from("clients").select("display_name").eq("id", invoice.client_id!).maybeSingle(),
      ])
    : [null, null];
  const firstSugg = first ? { mandate: first[1].name, href: `/mandates/${first[0]}`, count: first[1].people.length } : null;
  const line: Seg[] = dayLine({
    hour: istHour(),
    weekday,
    seed: Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000),
    month: monthName(today),
    workingDaysLeft: workingDaysLeft(today),
    joiningsToday,
    joiningsNextMonday: weekday === 5 ? (joins.data ?? []).filter((j) => j.joining_date === addDays(today, 3)).length : 0,
    joined,
    target,
    interviews: interviews.map((i) => ({ ...person(i.candidate_id, i.candidates?.full_name), client: i.mandates?.clients?.display_name ?? "", stage: i.stage, time: formatTime(i.interview_at!) })),
    rainInterviews: heavyRain ? interviews.filter((i) => inMumbai(i.mandates?.city)).length : 0,
    invoiceDue: invoice?.due_on
      ? { ...person(invoice.candidate_id!, invoiceName?.data?.full_name), client: invoiceClient?.data?.display_name ?? "The client", days: -daysSince(invoice.due_on) }
      : null,
    nextCall: nextCall?.scheduled_for ? { ...person(nextCall.candidate_id, nextCall.candidates?.full_name), time: formatTime(nextCall.scheduled_for), minutes: Math.round(minutesUntil(nextCall.scheduled_for)) } : null,
    callsLeft: (calls.data ?? []).filter((c) => c.scheduled_for && minutesUntil(c.scheduled_for) > -30).length,
    followUps: (follows.data ?? []).map((f) => ({ ...person(f.candidate_id, f.candidates?.full_name), late: f.follow_up_on ? Math.max(0, daysSince(f.follow_up_on)) : 0 })),
    quiet: quiet.data?.[0]?.id ? { client: quiet.data[0].client ?? "A mandate", href: `/mandates/${quiet.data[0].id}`, days: quiet.data[0].last_activity_at ? daysSince(quiet.data[0].last_activity_at) : 0 } : null,
    suggestion: firstSugg,
  });
  const moment = pickMoment({
    day: today,
    month: monthName(today),
    joiningsToday: joiningsToday.map((j) => j.name),
    joinDates: monthJoins.map((j) => j.joining_date!),
    target,
    heavyRain,
  });

  return (
    <div className="px-10 pb-28 pt-10">
      <header className="flex items-end justify-between gap-8">
        <div className="flex min-w-0 flex-1 items-end gap-5">
          <div className="min-w-0">
            <h1 className="font-display text-[56px] leading-none tracking-[-0.01em]">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-3 max-w-[640px] text-pretty text-[15.5px] text-muted">
              {formatLongDay(today)}.{" "}
              {line.map((seg, i) =>
                typeof seg === "string" ? (
                  <span key={i}>{seg}</span>
                ) : (
                  <Link key={i} href={seg.href} className="font-medium text-ink underline decoration-ink/20 underline-offset-[3px] transition-colors hover:decoration-ink">
                    {seg.text}
                  </Link>
                ),
              )}
            </p>
          </div>
          {moment ? <MomentArt moment={moment} day={today} /> : null}
        </div>
        <Link href="/billing" className="state state-ink block w-[280px] shrink-0 rounded-3xl bg-side px-5 py-4">
          <p className="text-[14px]">
            <b className="mr-1 text-[24px] font-semibold">{joined}</b> of {target} joinings in {monthName(today)}
          </p>
          <div className="my-2 flex h-2 overflow-hidden rounded-full bg-white" title={booked ? `${joined} joined, ${booked} more booked to join this month` : undefined}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, target ? (joined / target) * 100 : 0)}%` }} />
            {booked ? <div className="-ml-1 h-full rounded-r-full bg-sage" style={{ width: `calc(${Math.min(100, target ? (booked / target) * 100 : 0)}% + 4px)` }} /> : null}
          </div>
          {booked ? <p className="text-[12.5px] text-ink/70">{booked} more booked to join this month</p> : null}
          <p className="text-[12.5px] text-muted">
            {billedSum || toCollect
              ? `${billedSum ? `₹${formatLakhs(billedSum)} billed` : "Nothing billed yet"} · ${toCollect ? `₹${formatLakhs(toCollect)} to collect` : "nothing to collect"}`
              : `Nothing billed yet this month`}
          </p>
        </Link>
      </header>

      <FindBar />

      <div className="grid gap-4 lg:grid-cols-3">
        <Tile tone="mist" title="Calls today" className="lg:col-span-2" action={<Link href="/calendar" className="text-[12.5px] font-medium text-muted hover:text-ink">Calendar</Link>}>
          {nCalls ? (
            (calls.data ?? []).map((c) => {
              const phone = c.candidates?.candidate_phones?.[0]?.phone ?? null;
              const callHref = `/candidates/${c.candidate_id}/call?scheduled=${c.id}${c.mandate_id ? `&mandate=${c.mandate_id}` : ""}`;
              return (
                <PersonRow
                  key={c.id}
                  person={{ id: c.candidate_id, name: c.candidates?.full_name ?? "", phone }}
                  className="state state-ink group mt-1.5 flex items-center gap-3 overflow-hidden rounded-2xl bg-white/65 px-3 py-2.5 first:mt-0"
                >
                  <span className={`w-[74px] shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums ${c.id === nextCall?.id ? "text-accent" : ""}`}>{c.scheduled_for ? formatTime(c.scheduled_for) : ""}</span>
                  <Avatar name={c.candidates?.full_name ?? "?"} />
                  <Link href={`/candidates/${c.candidate_id}`} className="min-w-0 flex-1">
                    <b className="font-semibold">{c.candidates?.full_name}</b>
                    <small className="block truncate text-[12.5px] text-muted">
                      {[c.candidates?.designation, c.candidates?.firms?.name].filter(Boolean).join(" at ") || "No firm recorded"}
                    </small>
                  </Link>
                  <span className="swap">
                    <span className="swap-out rounded-full bg-white/80 px-2.5 py-0.5 text-[12.5px] text-muted">
                      {c.mandates ? `${c.mandates.clients?.display_name}, ${c.mandates.title}` : "General catch-up"}
                    </span>
                    <span className="swap-in">
                      <RowActions phone={phone} candidateId={c.candidate_id} callHref={callHref} />
                    </span>
                  </span>
                  {c.id === nextCall?.id ? (
                    <ButtonLink href={callHref} variant="primary" size="sm">
                      Start call
                    </ButtonLink>
                  ) : null}
                </PersonRow>
              );
            })
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/65 px-4 py-4">
              <span className="text-muted">No calls booked for you today. Book one from a candidate&apos;s profile.</span>
              <LogCallLink />
            </div>
          )}
        </Tile>

        <Tile tone="clay" title="Follow up">
          {nFollow ? (
            (follows.data ?? []).map((f) => {
              const late = f.follow_up_on ? daysSince(f.follow_up_on) : 0;
              return (
                <PersonRow
                  key={f.id}
                  person={{ id: f.candidate_id, name: f.candidates?.full_name ?? "", phone: f.candidates?.candidate_phones?.[0]?.phone }}
                  className="state state-ink group mt-1.5 flex items-center gap-3 overflow-hidden rounded-2xl bg-white/65 px-3 py-2.5 first:mt-0"
                >
                  <Avatar name={f.candidates?.full_name ?? "?"} />
                  <Link href={`/candidates/${f.candidate_id}`} className="min-w-0 flex-1">
                    <b className="font-semibold">{f.candidates?.full_name}</b>
                    <small className="block text-[12.5px] leading-snug text-muted">
                      {f.exit_note || "Asked for time"}. {f.mandates?.clients?.display_name}, {f.mandates?.title}
                    </small>
                  </Link>
                  <Badge tone={late > 0 ? "dark" : "neutral"} className={late > 0 ? "" : "bg-white text-ink"}>
                    {late > 0 ? `${late} day${late === 1 ? "" : "s"} late` : "Today"}
                  </Badge>
                </PersonRow>
              );
            })
          ) : (
            <p className="rounded-2xl bg-white/65 px-4 py-4 text-muted">Nothing to chase today.</p>
          )}
        </Tile>

        <Tile tone="sage" title="Suggested for a new mandate" className="lg:col-span-2">
          {first ? (
            <>
              <p className="mb-4 text-[14.5px] text-ink/70">
                <Link href={`/mandates/${first[0]}`} className="font-semibold text-ink underline decoration-ink/25 underline-offset-[3px] hover:decoration-ink">
                  {first[1].name}
                </Link>{" "}
                {first[1].people.length === 1 ? "has someone you've spoken to before who fits." : `has ${first[1].people.length} people you've spoken to before who fit.`}
              </p>
              <SuggestionShelf mandateId={first[0]} mandateName={first[1].name} people={first[1].people} />
              {others.length ? (
                <p className="mt-4 text-[13px] text-ink/70">
                  Also suggested:{" "}
                  {others.slice(0, 3).map(([id, g], i) => (
                    <span key={id}>
                      {i ? ", " : ""}
                      <Link href={`/mandates/${id}`} className="font-medium underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
                        {g.people.length} for {g.name}
                      </Link>
                    </span>
                  ))}
                  {others.length > 3 ? ` and ${others.length - 3} more` : ""}.
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded-2xl bg-white/60 px-4 py-4 text-ink/70">When a mandate opens, people you&apos;ve spoken to before who fit it appear here, ready to add.</p>
          )}
        </Tile>

        <Tile tone="sand" title="Going quiet">
          {quiet.data?.length ? (
            quiet.data.map((m) => (
              <Link key={m.id} href={`/mandates/${m.id}`} className="state state-ink mt-1.5 flex items-center gap-3 overflow-hidden rounded-2xl bg-white/65 px-3 py-2.5 first:mt-0">
                <span className="min-w-0 flex-1">
                  <b className="font-semibold">{m.client}</b>
                  <small className="block truncate text-[12.5px] text-muted">
                    {m.title}
                    {m.city ? `, ${m.city}` : ""}
                  </small>
                </span>
                <span className="text-right text-[12.5px] text-muted">
                  <b className="font-semibold text-ink">{m.last_activity_at ? daysSince(m.last_activity_at) : "?"} days</b> without news
                  <small className="block text-[12px]">{m.owner_id ? team[m.owner_id] ?? "" : "No owner"}</small>
                </span>
              </Link>
            ))
          ) : (
            <p className="rounded-2xl bg-white/65 px-4 py-4 text-muted">Every mandate has had news this week.</p>
          )}
        </Tile>
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[16.5px] font-semibold">Your mandates</h2>
          <Link href="/reminders" className="text-[13px] font-medium text-muted hover:text-ink">
            Everything that needs attention
          </Link>
        </div>
        {mine.data?.length ? (
          <div className="overflow-hidden rounded-3xl ring-1 ring-line">
            {mine.data.map((m) => (
              <Link key={m.id} href={`/mandates/${m.id}`} className="state state-ink grid grid-cols-[1.4fr_1fr_150px] items-center gap-6 border-b border-line px-5 py-3.5 last:border-0">
                <span className="min-w-0">
                  <b className="font-semibold">{m.client}</b>{" "}
                  <span className="text-muted">
                    {m.title}
                    {m.city ? `, ${m.city}` : ""}
                  </span>
                </span>
                <span className="flex gap-1.5">
                  {PHASES.map((p, i) => {
                    const n = phaseCount(m.id!, i);
                    return (
                      <span key={p.key} className="flex-1" title={`${p.label}: ${n}`}>
                        <span className={`block h-1.5 rounded-full ${n ? "bg-accent" : "bg-side"}`} />
                        <small className="mt-1 block text-[11.5px] text-muted">
                          {n} {p.label.toLowerCase()}
                        </small>
                      </span>
                    );
                  })}
                </span>
                <span className="text-right text-[12.5px] text-muted">{m.is_stale ? <Badge tone="warn">Quiet</Badge> : `News ${ago(m.last_activity_at)}`}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-3xl bg-side/70 px-5 py-6 text-muted">
            No mandates owned by you yet.{" "}
            <Link href="/mandates/new" className="font-medium text-accent underline underline-offset-2">
              Create one
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
