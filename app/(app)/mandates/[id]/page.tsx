import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import { Badge, Card, Page, PageHeader, TableSkeleton, Tile } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTeamNames } from "@/lib/auth/member";
import { getExitReasons } from "@/lib/data/options";
import { stageLabel } from "@/lib/constants";
import { ago, daysSince, formatDate, formatPqeRange } from "@/lib/format";
import { Board, type Entry } from "./board";
import { AddCandidate, Matches, StatusControl } from "./panels";

export const metadata: Metadata = { title: "Mandate" };

type Params = Promise<{ id: string }>;

export default function MandatePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="px-10 pt-24"><TableSkeleton /></div>}>
      <MandateScreen params={params} />
    </Suspense>
  );
}

async function MandateScreen({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [mq, bq, eqFull, sq, pq, matchq, aq, team, reasons] = await Promise.all([
    supabase.from("mandates").select("*, clients(id, display_name)").eq("id", id).maybeSingle(),
    supabase.from("v_mandate_board").select("in_play, cvs_shared, interviewed, joined, is_stale, days_open").eq("id", id).maybeSingle(),
    supabase
      .from("pipeline_entries")
      .select("id, candidate_id, stage, stage_changed_at, exit_reason, exit_note, follow_up_on, interview_at, owner_id, exit_reasons(label)")
      .eq("mandate_id", id)
      .order("stage_changed_at", { ascending: false }),
    supabase.from("cv_shares").select("id, pipeline_entry_id, candidate_id, shared_at, valid_until, channels, override_reason, shared_by").eq("mandate_id", id).order("shared_at", { ascending: false }),
    supabase.from("placements").select("pipeline_entry_id, status").eq("mandate_id", id),
    supabase.rpc("match_candidates_for_mandate", { p_mandate: id, p_limit: 30 }),
    supabase.from("activities").select("id, action, details, created_at, actor_id, entity_type, candidates(full_name)").eq("mandate_id", id).order("created_at", { ascending: false }).limit(25),
    getTeamNames(),
    getExitReasons(),
  ]);
  // Until migration 7 (interview dates) is applied, read the board without them rather than show it empty.
  const eq = eqFull.error
    ? await supabase
        .from("pipeline_entries")
        .select("id, candidate_id, stage, stage_changed_at, exit_reason, exit_note, follow_up_on, owner_id, exit_reasons(label)")
        .eq("mandate_id", id)
        .order("stage_changed_at", { ascending: false })
        .then((r) => ({ ...r, data: r.data?.map((e) => ({ ...e, interview_at: null as string | null })) ?? null }))
    : eqFull;
  const m = mq.data;
  if (!m) notFound();
  const b = bq.data;

  const candIds = [...new Set((eq.data ?? []).map((e) => e.candidate_id))];
  const { data: cands } = candIds.length
    ? await supabase.from("v_candidates").select("id, full_name, current_firm, pqe_today").in("id", candIds)
    : { data: [] as { id: string | null; full_name: string | null; current_firm: string | null; pqe_today: number | null }[] };
  const byId = new Map((cands ?? []).map((c) => [c.id, c]));
  const shared = new Set((sq.data ?? []).map((s) => s.pipeline_entry_id));
  const placed = new Map((pq.data ?? []).map((p) => [p.pipeline_entry_id, p.status]));

  const entries: Entry[] = (eq.data ?? []).map((e) => {
    const c = byId.get(e.candidate_id);
    return {
      id: e.id,
      candidate_id: e.candidate_id,
      name: c?.full_name ?? "—",
      firm: c?.current_firm ?? null,
      pqe: c?.pqe_today ?? null,
      stage: e.stage,
      stage_changed_at: e.stage_changed_at,
      days_in_stage: Math.max(0, daysSince(e.stage_changed_at)),
      exit_reason: e.exit_reason,
      exit_label: e.exit_reasons?.label ?? null,
      exit_note: e.exit_note,
      follow_up_on: e.follow_up_on,
      interview_at: e.interview_at,
      owner: e.owner_id ? team[e.owner_id] ?? "" : "",
      has_share: shared.has(e.id),
      placement: placed.get(e.id) ?? null,
    };
  });

  const matches = (matchq.data ?? []).map((x) => ({
    candidate_id: x.candidate_id,
    full_name: x.full_name,
    score: x.score,
    reasons: x.reasons ?? [],
    pqe_today: x.pqe_today,
    last_by: x.last_recruiter_id ? team[x.last_recruiter_id] ?? null : null,
    last_called_at: x.last_called_at,
  }));

  const intake: [string, string | null][] = [
    ["Team size", m.team_size],
    ["Team structure", m.team_structure],
    ["Client profile", m.client_profile],
    ["Work profile", m.work_profile],
    ["Soft points", m.soft_points],
    ["Pain points", m.pain_points],
    ["Research notes", m.research_notes],
  ];

  return (
    <>
      <PageHeader
        title={`${m.clients?.display_name ?? ""}, ${m.title}`}
        back={{ href: "/mandates", label: "Mandates" }}
        description={
          <>
            {[m.city, m.practice_area, formatPqeRange(m.pqe_min, m.pqe_max, m.grade_label), m.role_category === "support_staff" ? "Support staff" : null, m.headcount > 1 ? `${m.headcount} openings` : null]
              .filter((x) => x && x !== "—")
              .join(" · ")}
            <span className="mt-1 block text-[13.5px]">
              {m.owner_id ? `${team[m.owner_id] ?? "Someone"}'s mandate` : "No owner yet"}, received {formatDate(m.received_on)}
              {b ? ` (${b.days_open} days ago)` : ""}. Last news {ago(m.last_activity_at)}.
              {m.reopened_count > 0 ? ` Reopened ${m.reopened_count}×.` : ""}
            </span>
          </>
        }
        actions={
          <>
            <AddCandidate mandateId={id} />
            <ButtonLink href={`/mandates/${id}/edit`}>Edit</ButtonLink>
          </>
        }
      >
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusControl id={id} status={m.status} />
            {b?.is_stale ? <Badge tone="warn">Quiet for a while</Badge> : null}
            {m.replaces_placement_id ? <Badge tone="accent">Replacement, no fee</Badge> : null}
            <Link href={`/clients/${m.clients?.id}`} className="text-[13px] font-medium text-muted underline decoration-line underline-offset-2 hover:text-ink">
              {m.clients?.display_name} agreement and contacts
            </Link>
          </div>
          {b ? (
            <div className="flex gap-6 text-[13px] text-muted">
              <span>
                <b className="text-[18px] font-semibold tabular-nums text-ink">{b.in_play}</b> in play
              </span>
              <span>
                <b className="text-[18px] font-semibold tabular-nums text-ink">{b.cvs_shared}</b> CVs shared
              </span>
              <span>
                <b className="text-[18px] font-semibold tabular-nums text-ink">{b.interviewed}</b> interviewed
              </span>
              <span>
                <b className="text-[18px] font-semibold tabular-nums text-ink">{b.joined}</b> joined
              </span>
            </div>
          ) : null}
        </div>
      </PageHeader>

      <Page>
        <Board entries={entries} exitReasons={reasons} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-6">
            <section>
              <h2 className="mb-2.5 text-[16.5px] font-semibold">CVs shared</h2>
              {sq.data?.length ? (
                <Card className="divide-y divide-line text-[13px]">
                  {sq.data.map((s) => (
                    <div key={s.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                      <span>
                        <Link href={`/candidates/${s.candidate_id}`} className="font-medium hover:text-accent">
                          {byId.get(s.candidate_id)?.full_name ?? "—"}
                        </Link>{" "}
                        <span className="text-muted">
                          by {team[s.shared_by] ?? "—"} via {s.channels.join(", ")}
                          {s.override_reason ? ` · override: “${s.override_reason}”` : ""}
                        </span>
                      </span>
                      <span className="text-muted">
                        {formatDate(s.shared_at)} · ours until {formatDate(s.valid_until)}
                      </span>
                    </div>
                  ))}
                </Card>
              ) : (
                <p className="text-[13px] text-muted">No CVs shared yet.</p>
              )}
            </section>

            <section>
              <h2 className="mb-2.5 text-[16.5px] font-semibold">Intake</h2>
              {intake.some(([, v]) => v) ? (
                <Card className="p-4">
                  <dl className="grid gap-x-4 gap-y-2 text-[13px] md:grid-cols-[150px_1fr]">
                    {intake
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-muted">{k}</dt>
                          <dd className="whitespace-pre-wrap">{v}</dd>
                        </div>
                      ))}
                  </dl>
                </Card>
              ) : (
                <p className="text-[13px] text-muted">
                  No intake notes. <Link href={`/mandates/${id}/edit`} className="text-accent underline">Add them</Link>.
                </p>
              )}
            </section>

            <section>
              <h2 className="mb-2.5 text-[16.5px] font-semibold">Activity</h2>
              {aq.data?.length ? (
                <Card className="divide-y divide-line text-[13px]">
                  {aq.data.map((a) => {
                    const d = (a.details ?? {}) as Record<string, string>;
                    const who = a.candidates?.full_name;
                    const what =
                      a.action === "stage_changed"
                        ? `${who} → ${stageLabel(d.to)}`
                        : a.action === "exited"
                          ? `${who} dropped: ${d.reason?.replace(/_/g, " ")}`
                          : a.action === "reopened"
                            ? `${who} back in play`
                            : a.entity_type === "cv_shares"
                              ? `CV shared: ${who}`
                              : a.entity_type === "pipeline_entries"
                                ? `${who} added`
                                : a.entity_type === "screening_calls"
                                  ? `Call with ${who}`
                                  : a.entity_type === "placements"
                                    ? `Placement: ${who}`
                                    : a.action === "status_changed"
                                      ? `Mandate ${d.from?.replace("_", " ")} → ${d.to?.replace("_", " ")}`
                                      : a.action === "created"
                                        ? "Mandate created"
                                        : a.action.replace(/_/g, " ");
                    return (
                      <div key={a.id} className="flex justify-between gap-3 px-4 py-2">
                        <span>{what}</span>
                        <span className="whitespace-nowrap text-muted">
                          {a.actor_id ? `${team[a.actor_id] ?? ""}, ` : ""}
                          {ago(a.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              ) : (
                <p className="text-[13px] text-muted">Nothing yet.</p>
              )}
            </section>
          </div>

          <aside>
            <Tile tone="sage" title="Suggested for this mandate">
              <p className="-mt-1 mb-3 text-[12.5px] text-ink/65">People you&apos;ve spoken to before, matched on the firms they asked for, practice, experience today and city. Best fits first.</p>
              <Matches mandateId={id} matches={matches} />
            </Tile>
          </aside>
        </div>
      </Page>
    </>
  );
}
