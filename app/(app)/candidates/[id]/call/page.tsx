import type { Metadata } from "next";
import Link from "@/components/fast-link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar, Badge, Page, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTeamNames } from "@/lib/auth/member";
import { getFirmNames, getOpenMandates, getPracticeAreas } from "@/lib/data/options";
import { formatDateTime, formatLakhs, formatPqe } from "@/lib/format";
import { CallNotes } from "../widgets";
import { CallForm } from "./call-form";

export const metadata: Metadata = { title: "Screening call" };

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function CallPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <Suspense fallback={<div className="px-10 pt-24"><TableSkeleton /></div>}>
      <CallScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const outcomeTone = { fit: "ok", not_fit: "neutral", follow_up: "warn" } as const;
const outcomeLabel = { fit: "Fit", not_fit: "Not a fit", follow_up: "Follow up" } as const;

async function CallScreen({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: c }, { data: notes }, { data: calls }, mandates, firms, practices, team] = await Promise.all([
    supabase.from("v_candidates").select("id, full_name, current_firm, designation, pqe_today, current_city, notice_period_days, current_ctc, expected_ctc").eq("id", id).maybeSingle(),
    supabase.from("candidates").select("notes, notes_updated_at, notes_updated_by").eq("id", id).maybeSingle(),
    supabase
      .from("screening_calls")
      .select("*, mandates(title, clients(display_name))")
      .eq("candidate_id", id)
      .eq("status", "done")
      .order("called_at", { ascending: false, nullsFirst: false })
      .limit(10),
    getOpenMandates(),
    getFirmNames(),
    getPracticeAreas(),
    getTeamNames(),
  ]);
  if (!c) notFound();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 px-10 py-4 backdrop-blur-xl backdrop-saturate-150">
        <Link href={`/candidates/${id}`} className="state -ml-2 inline-flex rounded-full px-2 py-0.5 text-[13px] text-muted hover:text-ink">
          Back to {c.full_name}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <Avatar name={c.full_name ?? "?"} size={36} />
          <h1 className="font-display text-[30px] leading-none">Call with {c.full_name}</h1>
          <span className="text-[14px] text-muted">
            {[c.designation, c.current_firm, c.pqe_today != null ? formatPqe(c.pqe_today) : null].filter(Boolean).join(" · ")}
          </span>
        </div>
      </header>
      <Page>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* What was said before, beside the form: earlier calls first, then the notes on their profile. */}
          <aside className="max-h-96 space-y-4 overflow-y-auto overscroll-contain rounded-3xl xl:sticky xl:top-28 xl:order-2 xl:max-h-[calc(100vh-8.5rem)]">
            <section className="rounded-3xl bg-surface px-5 py-4 ring-1 ring-line">
              <h2 className="text-[15.5px] font-semibold">Earlier calls{calls?.length ? ` (${calls.length})` : ""}</h2>
              {calls?.length ? (
                <div className="divide-y divide-line">
                  {calls.map((s) => (
                    <div key={s.id} className="py-3 last:pb-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                        <span>
                          <b>{team[s.recruiter_id] ?? "Someone"}</b> · {formatDateTime(s.called_at)}
                        </span>
                        {s.outcome ? <Badge tone={outcomeTone[s.outcome]}>{outcomeLabel[s.outcome]}</Badge> : null}
                      </div>
                      {s.mandates ? <p className="text-[12px] text-muted">For {s.mandates.clients?.display_name} · {s.mandates.title}</p> : null}
                      <CallNotes
                        plain
                        notes={[
                          ["Discussion", s.discussion],
                          ["Next", s.action_points],
                          ["Looking for", s.looking_for],
                          ["Non-negotiables", s.non_negotiables],
                          ["Current CTC", s.current_ctc != null ? formatLakhs(s.current_ctc) : null],
                          ["Expected CTC", s.expected_ctc != null ? formatLakhs(s.expected_ctc) : null],
                          ["Notice period", s.notice_period_days != null ? `${s.notice_period_days} days` : null],
                          ["City", s.current_city],
                          ["Work history", s.work_history],
                          ["Nature of work", s.nature_of_work],
                          ["Industries and clients", s.industries_clients],
                          ["Team experience", s.team_experience],
                          ["Education", s.education],
                          ["Applications made", s.applications_made],
                        ]}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[13px] text-muted">First call with them: nothing logged before.</p>
              )}
            </section>
            {notes?.notes ? (
              <section className="rounded-3xl bg-sand px-5 py-4">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h2 className="text-[15.5px] font-semibold">Notes</h2>
                  <span className="text-[12px] text-muted">
                    {notes.notes_updated_by ? `${team[notes.notes_updated_by] ?? ""}, ` : ""}
                    {formatDateTime(notes.notes_updated_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{notes.notes}</p>
              </section>
            ) : null}
          </aside>
          <div className="min-w-0 xl:order-1">
        <CallForm
          candidateId={id}
          scheduledId={one(sp.scheduled)}
          mandateId={one(sp.mandate)}
          mandates={mandates}
          firms={firms}
          practices={practices}
          known={{
            current_city: c.current_city ?? "",
            notice_period_days: c.notice_period_days != null ? String(c.notice_period_days) : "",
            current_ctc: c.current_ctc != null ? String(+(c.current_ctc / 100_000).toFixed(2)) : "",
            expected_ctc: c.expected_ctc != null ? String(+(c.expected_ctc / 100_000).toFixed(2)) : "",
          }}
        />
          </div>
        </div>
      </Page>
    </>
  );
}
