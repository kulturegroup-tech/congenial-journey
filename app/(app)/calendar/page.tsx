import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { PersonRow } from "@/components/context-menu";
import { TitleBar } from "@/components/title-bar";
import { TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/member";
import { stageLabel } from "@/lib/constants";
import { addDays, formatLongDay, formatTime, istDayOf, istStart, monthEnd, monthName, monthStart, todayIst, weekStart } from "@/lib/format";

export const metadata: Metadata = { title: "Calendar" };

type SP = Promise<Record<string, string | string[] | undefined>>;
type Kind = "call" | "interview" | "follow" | "join" | "pay" | "replace";
type Ev = { key: string; day: string; at?: string; kind: Kind; title: string; sub: string; href: string; done?: boolean; person?: { id: string; name: string } };

const kinds: { kind: Kind; label: string; dot: string }[] = [
  { kind: "call", label: "Calls", dot: "bg-[#5b7f9c]" },
  { kind: "interview", label: "Interviews", dot: "bg-lilac-ink" },
  { kind: "join", label: "Joinings", dot: "bg-hero" },
  { kind: "follow", label: "Follow-ups", dot: "bg-[#c28766]" },
  { kind: "pay", label: "Payments due", dot: "bg-[#b59a55]" },
];
const evStyle: Record<Kind, string> = {
  call: "bg-mist before:bg-[#5b7f9c]",
  interview: "bg-lilac before:bg-lilac-ink",
  follow: "bg-clay before:bg-[#c28766]",
  pay: "bg-sand before:bg-[#b59a55]",
  replace: "bg-white ring-1 ring-line before:bg-faint",
  join: "bg-hero text-white before:hidden",
};

export default function CalendarPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <TitleBar title="Calendar" />
      <Suspense
        fallback={
          <div className="px-10 pt-24">
            <TableSkeleton />
          </div>
        }
      >
        <CalendarScreen searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function CalendarScreen({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = await getSession();
  const me = session.state === "member" ? session.member.id : "";
  const today = todayIst();
  const view = (["day", "week", "month"].includes(one(sp.view)) ? one(sp.view) : "week") as "day" | "week" | "month";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.d)) ? one(sp.d) : today;
  const mine = one(sp.mine) === "1";

  const from = view === "day" ? d : view === "week" ? weekStart(d) : weekStart(monthStart(d));
  const until = view === "day" ? d : view === "week" ? addDays(from, 6) : addDays(weekStart(monthEnd(d)), 6);
  const days: string[] = [];
  for (let x = from; x <= until; x = addDays(x, 1)) days.push(x);
  const t0 = istStart(from);
  const t1 = istStart(addDays(until, 1));

  const supabase = await createClient();
  const [booked, done, interviews, follows, joins, pays] = await Promise.all([
    supabase.from("screening_calls").select("id, scheduled_for, recruiter_id, candidate_id, mandate_id, candidates(full_name), mandates(title, clients(display_name))").eq("status", "scheduled").gte("scheduled_for", t0).lt("scheduled_for", t1),
    supabase.from("screening_calls").select("id, called_at, recruiter_id, candidate_id, candidates(full_name), mandates(title, clients(display_name))").eq("status", "done").gte("called_at", t0).lt("called_at", t1),
    supabase.from("pipeline_entries").select("id, stage, interview_at, owner_id, candidate_id, mandate_id, candidates(full_name), mandates(title, clients(display_name))").is("exit_reason", null).gte("interview_at", t0).lt("interview_at", t1),
    supabase.from("pipeline_entries").select("id, follow_up_on, owner_id, exit_note, candidate_id, candidates(full_name), mandates(title, clients(display_name))").gte("follow_up_on", from).lte("follow_up_on", until),
    supabase
      .from("placements")
      .select("id, status, joining_date, replacement_until, candidate_id, mandate_id, candidates(full_name), clients(display_name), mandates!placements_mandate_id_fkey(title, owner_id), invoices(id, status)")
      .neq("status", "backed_out")
      .or(`and(joining_date.gte.${from},joining_date.lte.${until}),and(replacement_until.gte.${from},replacement_until.lte.${until})`),
    supabase.from("invoices").select("id, invoice_number, due_on, total, sent_by, clients(display_name)").in("status", ["sent", "part_paid"]).gte("due_on", from).lte("due_on", until),
  ]);

  const evs: Ev[] = [];
  for (const c of booked.data ?? [])
    if (!mine || c.recruiter_id === me)
      evs.push({
        key: `c${c.id}`,
        day: istDayOf(c.scheduled_for!),
        at: c.scheduled_for!,
        kind: "call",
        title: c.candidates?.full_name ?? "—",
        sub: `Call · ${c.mandates ? `${c.mandates.clients?.display_name}, ${c.mandates.title}` : "General"}`,
        href: `/candidates/${c.candidate_id}/call?scheduled=${c.id}${c.mandate_id ? `&mandate=${c.mandate_id}` : ""}`,
        person: { id: c.candidate_id, name: c.candidates?.full_name ?? "" },
      });
  for (const c of done.data ?? [])
    if (!mine || c.recruiter_id === me)
      evs.push({
        key: `d${c.id}`,
        day: istDayOf(c.called_at!),
        at: c.called_at!,
        kind: "call",
        done: true,
        title: c.candidates?.full_name ?? "—",
        sub: `Called · ${c.mandates ? c.mandates.clients?.display_name : "General"}`,
        href: `/candidates/${c.candidate_id}`,
        person: { id: c.candidate_id, name: c.candidates?.full_name ?? "" },
      });
  for (const p of interviews.data ?? [])
    if (!mine || p.owner_id === me)
      evs.push({
        key: `i${p.id}`,
        day: istDayOf(p.interview_at!),
        at: p.interview_at!,
        kind: "interview",
        title: p.candidates?.full_name ?? "—",
        sub: `${stageLabel(p.stage)} · ${p.mandates?.clients?.display_name}, ${p.mandates?.title}`,
        href: `/mandates/${p.mandate_id}`,
        person: { id: p.candidate_id, name: p.candidates?.full_name ?? "" },
      });
  for (const f of follows.data ?? [])
    if (!mine || f.owner_id === me)
      evs.push({
        key: `f${f.id}`,
        day: f.follow_up_on!,
        kind: "follow",
        title: f.candidates?.full_name ?? "—",
        sub: `Follow up · ${f.exit_note || f.mandates?.clients?.display_name || ""}`,
        href: `/candidates/${f.candidate_id}`,
        person: { id: f.candidate_id, name: f.candidates?.full_name ?? "" },
      });
  for (const p of joins.data ?? []) {
    if (mine && p.mandates?.owner_id !== me) continue;
    if (p.joining_date && p.joining_date >= from && p.joining_date <= until)
      evs.push({
        key: `j${p.id}`,
        day: p.joining_date,
        kind: "join",
        title: `${p.candidates?.full_name} joins ${p.clients?.display_name}`,
        sub: p.invoices.some((i) => i.status !== "cancelled") ? p.mandates?.title ?? "" : "Raise the invoice that day",
        href: "/billing",
      });
    if (p.status === "joined" && p.replacement_until && p.replacement_until >= from && p.replacement_until <= until)
      evs.push({ key: `r${p.id}`, day: p.replacement_until, kind: "replace", title: p.candidates?.full_name ?? "—", sub: `Replacement window ends · ${p.clients?.display_name}`, href: "/billing" });
  }
  for (const i of pays.data ?? [])
    if (!mine || i.sent_by === me)
      evs.push({ key: `p${i.id}`, day: i.due_on, kind: "pay", title: i.invoice_number, sub: `Payment due · ${i.clients?.display_name}`, href: `/billing/invoices/${i.id}` });

  const byDay = new Map<string, Ev[]>();
  for (const e of evs) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  for (const list of byDay.values()) list.sort((a, b) => (a.kind === "join" ? -1 : b.kind === "join" ? 1 : 0) || (a.at ?? "").localeCompare(b.at ?? "") || (a.at ? 1 : -1));

  const count = (k: Kind) => evs.filter((e) => e.kind === k && !e.done).length;
  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const prev = view === "month" ? addDays(monthStart(d), -1) : addDays(d, -step);
  const next = view === "month" ? addDays(monthEnd(d), 1) : addDays(d, step);
  const href = (o: Partial<{ view: string; d: string; mine: boolean }>) => {
    const q = new URLSearchParams();
    const v = o.view ?? view;
    if (v !== "week") q.set("view", v);
    const dd = o.d ?? d;
    if (dd !== today) q.set("d", dd);
    if (o.mine ?? mine) q.set("mine", "1");
    const s = q.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };
  const title = view === "day" ? (d === today ? "Today" : formatLongDay(d)) : view === "week" ? (weekStart(today) === from ? "This week" : `Week of ${formatLongDay(from).split(" ").slice(1).join(" ")}`) : `${monthName(d)} ${d.slice(0, 4)}`;
  const summary = [count("call") && `${count("call")} calls`, count("interview") && `${count("interview")} interviews`, count("join") && `${count("join")} joining${count("join") === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="px-10 pb-28 pt-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-[48px] leading-none tracking-[-0.01em]">{title}</h1>
          <p className="mt-3 text-[15px] text-muted">{summary || "Nothing booked."}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full bg-side p-1">
            {(["day", "week", "month"] as const).map((v) => (
              <Link key={v} href={href({ view: v })} className={`rounded-full px-4 py-1.5 font-medium capitalize transition-colors ${v === view ? "bg-surface text-ink shadow-[0_4px_12px_-8px_rgb(29_42_36/0.5)]" : "text-muted hover:text-ink"}`}>
                {v}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Link href={href({ d: prev })} aria-label="Earlier" className="state grid h-10 w-10 place-items-center rounded-full ring-1 ring-inset ring-line">
              <ChevronLeft size={17} />
            </Link>
            <Link href={href({ d: today })} className="state flex h-10 items-center rounded-full px-4 font-medium ring-1 ring-inset ring-line">
              Today
            </Link>
            <Link href={href({ d: next })} aria-label="Later" className="state grid h-10 w-10 place-items-center rounded-full ring-1 ring-inset ring-line">
              <ChevronRight size={17} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mb-4 mt-7 flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <span key={k.kind} className="inline-flex items-center gap-2 rounded-full bg-side px-3 py-1.5 text-[12.5px] font-medium">
            <span className={`h-2 w-2 rounded-full ${k.dot}`} />
            {k.label}
          </span>
        ))}
        <Link href={href({ mine: !mine })} className="ml-auto flex items-center gap-2.5 text-[13px] font-medium text-muted hover:text-ink">
          <span className={`relative h-5 w-9 rounded-full transition-colors ${mine ? "bg-accent" : "bg-line"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] duration-500 [transition-timing-function:var(--ease-spring)] ${mine ? "left-[18px]" : "left-0.5"}`} />
          </span>
          Only mine
        </Link>
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1.5">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div key={w} className="px-2 pb-1 text-[12.5px] font-medium text-muted">
              {w}
            </div>
          ))}
          {days.map((day) => {
            const list = byDay.get(day) ?? [];
            const out = day.slice(0, 7) !== d.slice(0, 7);
            return (
              <Link
                key={day}
                href={href({ view: "day", d: day })}
                className={`state state-ink min-h-[118px] rounded-2xl p-2 ${day === today ? "bg-surface ring-[1.5px] ring-ink" : "bg-side"} ${out ? "opacity-45" : ""}`}
              >
                <span className={`mb-1 block px-1 text-[13px] font-semibold ${day === today ? "text-accent" : ""}`}>{Number(day.slice(8))}</span>
                {list.slice(0, 3).map((e) => (
                  <span key={e.key} className={`mb-1 block truncate rounded-lg px-2 py-0.5 text-[11.5px] font-medium ${e.kind === "join" ? "bg-hero text-white" : e.kind === "interview" ? "bg-lilac" : e.kind === "follow" ? "bg-clay" : e.kind === "pay" ? "bg-sand" : "bg-mist"} ${e.done ? "opacity-50" : ""}`}>
                    {e.at ? `${formatTime(e.at)} ` : ""}
                    {e.title}
                  </span>
                ))}
                {list.length > 3 ? <span className="px-1 text-[11.5px] text-muted">{list.length - 3} more</span> : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={view === "week" ? "grid grid-cols-7 gap-2.5" : "max-w-2xl"}>
          {days.map((day) => {
            const list = byDay.get(day) ?? [];
            const isToday = day === today;
            return (
              <div key={day} className={`min-h-[480px] rounded-3xl p-2.5 transition-colors ${isToday ? "bg-surface ring-[1.5px] ring-ink" : "bg-side hover:bg-[#e8ece5]"}`}>
                <Link href={href({ view: "day", d: day })} className="flex items-baseline gap-1.5 px-1.5 pb-3 pt-1">
                  <span className="text-[13px] font-medium text-muted">{formatLongDay(day).split(" ")[0].slice(0, view === "day" ? 20 : 3)}</span>
                  <b className="text-[22px] font-semibold">{Number(day.slice(8))}</b>
                  {isToday ? <span className="ml-auto rounded-full bg-sage px-2 py-0.5 text-[11.5px] font-semibold text-hero">Today</span> : null}
                </Link>
                {list.length ? (
                  list.map((e) => <Event key={e.key} e={e} />)
                ) : (
                  <p className="px-2 text-[12.5px] text-muted">Nothing planned</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-[12.5px] text-muted">
        Calls come from bookings on candidate profiles. Interviews appear when you add the date while moving someone to Interview, Assignment or Final round.
      </p>
    </div>
  );
}

function Event({ e }: { e: Ev }) {
  const body = (
    <Link
      href={e.href}
      className={`relative mb-2 block rounded-2xl py-2.5 pl-4 pr-3 transition-[transform,box-shadow] duration-500 [transition-timing-function:var(--ease-spring)] before:absolute before:bottom-2.5 before:left-1.5 before:top-2.5 before:w-[3px] before:rounded-full hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-16px_rgb(29_42_36/0.45)] ${evStyle[e.kind]} ${e.done ? "opacity-55" : ""}`}
    >
      {e.kind === "join" ? <PartyPopper size={16} className="mb-1 text-sage" /> : null}
      {e.at ? <span className={`block text-[11.5px] font-semibold ${e.kind === "join" ? "text-white/70" : "text-muted"}`}>{formatTime(e.at)}</span> : null}
      <b className="block text-[13px] font-semibold leading-snug">{e.title}</b>
      <small className={`mt-0.5 block text-[11.5px] leading-snug ${e.kind === "join" ? "text-white/70" : "text-muted"}`}>{e.sub}</small>
    </Link>
  );
  return e.person ? <PersonRow person={e.person}>{body}</PersonRow> : body;
}
