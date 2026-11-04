import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import { Avatar, Badge, Card, Empty, Page, PageHeader, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession, getTeamNames } from "@/lib/auth/member";
import { getFirmNames, getOpenMandates, getPracticeAreas, getTeam } from "@/lib/data/options";
import { stageLabel } from "@/lib/constants";
import { ago, formatDate, formatDateTime, formatLakhs, formatPhone, formatPqe } from "@/lib/format";
import { AddContact, AddInterest, AddPrior, AddToMandate, CallNotes, CancelCall, CvOpen, CvUpload, DeleteButton, ScheduleCall } from "./widgets";

export const metadata: Metadata = { title: "Candidate" };

type Params = Promise<{ id: string }>;

export default function CandidatePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="px-10 pt-24"><TableSkeleton /></div>}>
      <Profile params={params} />
    </Suspense>
  );
}

const routeLabel: Record<string, string> = {
  other_agency: "another agency",
  job_portal: "job portal",
  client_website: "firm's website",
  direct_email: "direct email",
  other: "other",
};
const outcomeTone = { fit: "ok", not_fit: "neutral", follow_up: "warn" } as const;
const outcomeLabel = { fit: "Fit", not_fit: "Not a fit", follow_up: "Follow up" } as const;

async function Profile({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [cand, phones, emails, calls, tags, priors, pipes, files, acts, team, teamList, mandates, firms, practices, session] = await Promise.all([
    supabase.from("v_candidates").select("*").eq("id", id).maybeSingle(),
    supabase.from("candidate_phones").select("id, phone, source, is_primary").eq("candidate_id", id).order("is_primary", { ascending: false }),
    supabase.from("candidate_emails").select("id, email").eq("candidate_id", id),
    supabase.from("screening_calls").select("*").eq("candidate_id", id).neq("status", "cancelled").order("created_at", { ascending: false }),
    supabase.from("interest_tags").select("id, city, practice_area, role_text, not_taken_reason, created_at, firms(name)").eq("candidate_id", id).order("created_at", { ascending: false }),
    supabase.from("prior_applications").select("id, route, applied_on, details, firms(name)").eq("candidate_id", id).order("applied_on", { ascending: false, nullsFirst: true }),
    supabase
      .from("pipeline_entries")
      .select("id, stage, exit_reason, exit_note, follow_up_on, stage_changed_at, mandate_id, mandates(title, status, city, clients(display_name)), exit_reasons(label)")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("candidate_files").select("id, file_name, version, created_at").eq("candidate_id", id).order("version", { ascending: false }),
    supabase.from("activities").select("id, entity_type, action, details, created_at, actor_id, mandates(title)").eq("candidate_id", id).order("created_at", { ascending: false }).limit(20),
    getTeamNames(),
    getTeam(),
    getOpenMandates(),
    getFirmNames(),
    getPracticeAreas(),
    getSession(),
  ]);
  const c = cand.data;
  if (!c) notFound();
  const me = session.state === "member" ? session.member.id : "";
  const scheduled = (calls.data ?? []).filter((x) => x.status === "scheduled");
  const done = (calls.data ?? []).filter((x) => x.status === "done");

  return (
    <>
      <PageHeader
        title={c.full_name ?? ""}
        back={{ href: "/candidates", label: "Candidates" }}
        leading={<Avatar name={c.full_name ?? "?"} size={64} />}
        description={
          <>
            {[c.designation, c.current_firm].filter(Boolean).join(" at ") || "No current firm recorded"}
            {c.current_city ? `, ${c.current_city}` : ""}
          </>
        }
        actions={
          <>
            <ButtonLink href={`/candidates/${id}/call`} variant="primary">
              Log a call
            </ButtonLink>
            <ScheduleCall candidateId={id} mandates={mandates} team={teamList.filter((t) => t.active).map((t) => ({ id: t.id, label: t.full_name }))} me={me} />
            <AddToMandate candidateId={id} mandates={mandates} />
            <ButtonLink href={`/candidates/${id}/edit`} variant="ghost">
              Edit
            </ButtonLink>
          </>
        }
      >
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          {c.pqe_today != null ? <Badge tone="accent">{formatPqe(c.pqe_today)} experience</Badge> : null}
          {c.seniority ? <Badge>{c.seniority}</Badge> : null}
          {(c.practice_areas ?? []).map((p) => (
            <Badge key={p}>{p}</Badge>
          ))}
          {c.review_note === "Demo data" ? <Badge tone="warn">Demo</Badge> : null}
          {c.linkedin_url ? (
            <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="ml-1 text-[13px] font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
              LinkedIn profile
            </a>
          ) : null}
        </div>
      </PageHeader>

      <Page>
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            {scheduled.length ? (
              <Card className="bg-mist px-5 py-3 ring-0">
                {scheduled.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                    <span>
                      Call booked for <b>{formatDateTime(s.scheduled_for)}</b> with {team[s.recruiter_id] ?? "—"}
                    </span>
                    <span className="flex items-center gap-3">
                      <Link href={`/candidates/${id}/call?scheduled=${s.id}${s.mandate_id ? `&mandate=${s.mandate_id}` : ""}`} className="text-[13px] font-medium text-accent hover:underline">
                        Log this call
                      </Link>
                      <CancelCall id={s.id} />
                    </span>
                  </div>
                ))}
              </Card>
            ) : null}

            <section>
              <h2 className="mb-2.5 text-[16.5px] font-semibold">Mandates</h2>
              {pipes.data?.length ? (
                <Card className="divide-y divide-line">
                  {pipes.data.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div>
                        <Link href={`/mandates/${p.mandate_id}`} className="font-medium hover:text-accent">
                          {p.mandates?.clients?.display_name} · {p.mandates?.title}
                        </Link>
                        <div className="text-[12px] text-muted">
                          {p.mandates?.city ?? ""} {p.mandates?.status !== "active" ? `· mandate ${p.mandates?.status?.replace("_", " ")}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        {p.exit_reason ? (
                          <Badge tone={p.exit_reason === "asked_for_time" ? "warn" : "neutral"}>
                            {p.exit_reasons?.label ?? p.exit_reason}
                            {p.follow_up_on ? ` · follow up ${formatDate(p.follow_up_on)}` : ""}
                          </Badge>
                        ) : (
                          <Badge tone={p.stage === "joined" ? "ok" : "accent"}>{stageLabel(p.stage)}</Badge>
                        )}
                        <div className="mt-0.5 text-[12px] text-muted">since {ago(p.stage_changed_at)}</div>
                      </div>
                    </div>
                  ))}
                </Card>
              ) : (
                <Empty title="Not on any mandate yet" />
              )}
            </section>

            <section>
              <h2 className="mb-2.5 text-[16.5px] font-semibold">Screening calls</h2>
              {done.length ? (
                <Card className="divide-y divide-line">
                  {done.map((s) => (
                    <div key={s.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <b>{team[s.recruiter_id] ?? "—"}</b> · {formatDateTime(s.called_at)}
                        </span>
                        {s.outcome ? <Badge tone={outcomeTone[s.outcome]}>{outcomeLabel[s.outcome]}</Badge> : null}
                      </div>
                      {s.looking_for ? <p className="mt-1 text-[13px]"><span className="text-muted">Looking for:</span> {s.looking_for}</p> : null}
                      {s.action_points ? <p className="text-[13px]"><span className="text-muted">Next:</span> {s.action_points}</p> : null}
                      <CallNotes
                        notes={[
                          ["Education", s.education],
                          ["Work history", s.work_history],
                          ["Nature of work", s.nature_of_work],
                          ["Industries and clients", s.industries_clients],
                          ["Team experience", s.team_experience],
                          ["Non-negotiables", s.non_negotiables],
                          ["City", s.current_city],
                          ["Notice period", s.notice_period_days != null ? `${s.notice_period_days} days` : null],
                          ["Current CTC", s.current_ctc != null ? formatLakhs(s.current_ctc) : null],
                          ["Expected CTC", s.expected_ctc != null ? formatLakhs(s.expected_ctc) : null],
                          ["Applications made", s.applications_made],
                          ["Discussion", s.discussion],
                        ]}
                      />
                    </div>
                  ))}
                </Card>
              ) : (
                <Empty title="No calls logged yet">Log the first call to capture the 14 screening fields.</Empty>
              )}
            </section>

            <section>
              <h2 className="mb-2.5 text-[16.5px] font-semibold">Activity</h2>
              {acts.data?.length ? (
                <Card className="divide-y divide-line text-[13px]">
                  {acts.data.map((a) => {
                    const d = (a.details ?? {}) as Record<string, string>;
                    const what =
                      a.action === "stage_changed"
                        ? `Moved to ${stageLabel(d.to)}`
                        : a.action === "exited"
                          ? `Dropped: ${d.reason?.replace(/_/g, " ")}`
                          : a.action === "created" && a.entity_type === "cv_shares"
                            ? "CV shared"
                            : a.action === "created" && a.entity_type === "pipeline_entries"
                              ? "Added to a mandate"
                              : a.action === "created" && a.entity_type === "screening_calls"
                                ? "Call logged"
                                : a.action.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase());
                    return (
                      <div key={a.id} className="flex justify-between gap-3 px-4 py-2">
                        <span>
                          {what}
                          {a.mandates?.title ? <span className="text-muted"> · {a.mandates.title}</span> : null}
                        </span>
                        <span className="whitespace-nowrap text-muted">
                          {a.actor_id ? `${team[a.actor_id] ?? ""}, ` : ""}
                          {ago(a.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              ) : (
                <Empty title="No activity yet" />
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <Card className="p-5 ring-0 bg-side">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[15.5px] font-semibold">Contact</h3>
                <AddContact candidateId={id} />
              </div>
              {phones.data?.length || emails.data?.length ? (
                <ul className="space-y-1.5">
                  {phones.data?.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <a href={`tel:${p.phone}`} className="text-[13.5px] tabular-nums hover:text-accent">
                        {formatPhone(p.phone)}
                      </a>
                      <span className="flex items-center gap-2">
                        {p.source === "weekday" ? <Badge>Weekday</Badge> : null}
                        <DeleteButton table="candidate_phones" id={p.id} />
                      </span>
                    </li>
                  ))}
                  {emails.data?.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2">
                      <a href={`mailto:${e.email}`} className="truncate text-[13px] hover:text-accent">
                        {e.email}
                      </a>
                      <DeleteButton table="candidate_emails" id={e.id} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">No number yet. Check Weekday, then add it here.</p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="mb-2.5 text-[15.5px] font-semibold">Details</h3>
              <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
                <dt className="text-muted">Current CTC</dt>
                <dd>{c.current_ctc != null ? formatLakhs(c.current_ctc) : "—"}</dd>
                <dt className="text-muted">Expected</dt>
                <dd>{c.expected_ctc != null ? formatLakhs(c.expected_ctc) : "—"}</dd>
                <dt className="text-muted">Notice</dt>
                <dd>{c.notice_period_days != null ? `${c.notice_period_days} days` : "—"}</dd>
                <dt className="text-muted">Open to</dt>
                <dd>{(c.preferred_cities ?? []).join(", ") || "—"}</dd>
                <dt className="text-muted">Graduated</dt>
                <dd>{c.graduation_year ?? "—"}</dd>
                <dt className="text-muted">Source</dt>
                <dd>{c.source?.replace(/_/g, " ") ?? "—"}</dd>
                <dt className="text-muted">Owner</dt>
                <dd>{c.owner_id ? team[c.owner_id] ?? "—" : "—"}</dd>
                <dt className="text-muted">Added</dt>
                <dd>{formatDate(c.created_at)}</dd>
              </dl>
            </Card>

            <Card className="p-5 ring-0 bg-accent-soft">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[15.5px] font-semibold">What they want</h3>
                <AddInterest candidateId={id} firms={firms} practices={practices} />
              </div>
              <p className="mb-2 text-[12px] text-muted">When a matching mandate opens, they show up as suggested.</p>
              {tags.data?.length ? (
                <ul className="space-y-2 text-[13px]">
                  {tags.data.map((t) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <span>
                        {[t.firms?.name, t.city, t.practice_area, t.role_text].filter(Boolean).join(" · ")}
                        {t.not_taken_reason ? <span className="block text-[12px] text-muted">{t.not_taken_reason}</span> : null}
                      </span>
                      <DeleteButton table="interest_tags" id={t.id} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">Nothing recorded.</p>
              )}
            </Card>

            <Card className="p-5 ring-0 bg-sand">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[15.5px] font-semibold">Already applied to</h3>
                <AddPrior candidateId={id} firms={firms} />
              </div>
              <p className="mb-2 text-[12px] text-muted">Used by the duplicate check.</p>
              {priors.data?.length ? (
                <ul className="space-y-2 text-[13px]">
                  {priors.data.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>
                        <b>{p.firms?.name}</b> via {routeLabel[p.route]}
                        <span className="block text-[12px] text-muted">{p.applied_on ? formatDate(p.applied_on) : "date unknown"}</span>
                      </span>
                      <DeleteButton table="prior_applications" id={p.id} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">None recorded.</p>
              )}
            </Card>

            <Card className="p-5 ring-0 bg-side">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[15.5px] font-semibold">CVs</h3>
                <CvUpload candidateId={id} />
              </div>
              {files.data?.length ? (
                <ul className="space-y-1.5 text-[13px]">
                  {files.data.map((f) => (
                    <li key={f.id} className="flex justify-between gap-2">
                      <CvOpen fileId={f.id} name={f.file_name} />
                      <span className="whitespace-nowrap text-muted">
                        v{f.version} · {formatDate(f.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">No CV uploaded.</p>
              )}
            </Card>
          </aside>
        </div>
      </Page>
    </>
  );
}
