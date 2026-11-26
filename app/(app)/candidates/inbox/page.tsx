import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/components/fast-link";
import { ButtonLink } from "@/components/form";
import { RowLink } from "@/components/row-link";
import { Badge, Card, Empty, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession, getTeamNames } from "@/lib/auth/member";
import { cvReaderKeySet } from "@/lib/ai/cv-reader";
import { pqeYears, type CvExtract } from "@/lib/cv-extract";
import { ago, formatPqe } from "@/lib/format";
import { DiscardButton, InboxUploader, ReadButton } from "./widgets";

export const metadata: Metadata = { title: "CV inbox" };

const STUCK_MS = 3 * 60 * 1000;
/** A read that started over 3 minutes ago and never finished (the tab closed, the server restarted). */
const stuck = (r: { status: string; updated_at: string }) => r.status === "reading" && Date.now() - new Date(r.updated_at).getTime() > STUCK_MS;

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="CV inbox"
        back={{ href: "/candidates", label: "Candidates" }}
        description="Drop in CVs, one or many. AI reads each one; you check the details against the CV before the candidate is added."
      />
      <Page>
        <Suspense fallback={<TableSkeleton />}>
          <InboxBody />
        </Suspense>
      </Page>
    </>
  );
}

async function InboxBody() {
  const supabase = await createClient();
  const [{ data: settings }, session, team, open, saved] = await Promise.all([
    supabase.from("settings").select("ai_cv_reading").eq("id", true).maybeSingle(),
    getSession(),
    getTeamNames(),
    supabase
      .from("cv_inbox")
      .select("id, file_name, status, extracted, error, uploaded_by, created_at, updated_at")
      .in("status", ["uploaded", "reading", "ready", "failed"])
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("cv_inbox")
      .select("id, file_name, updated_at, candidate_id, candidates(full_name)")
      .eq("status", "saved")
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);
  const isAdmin = session.state === "member" && session.member.is_admin;
  const on = !!settings?.ai_cv_reading;
  const keySet = cvReaderKeySet();
  const rows = open.data ?? [];
  const waiting = rows.filter((r) => r.status === "uploaded" || stuck(r)).map((r) => r.id);

  return (
    <div className="max-w-6xl space-y-6">
      {!on ? (
        <Empty
          title="Reading CVs with AI is switched off"
          action={isAdmin ? <ButtonLink href="/settings#cv-reader" variant="primary">Turn it on in Settings</ButtonLink> : null}
        >
          {isAdmin
            ? "Each CV is sent to Anthropic's Claude API to be read. Turn it on once you're happy with that."
            : "An admin can turn it on in Settings. Until then, add candidates by hand."}
        </Empty>
      ) : !keySet ? (
        <Card className="bg-warn-soft p-5 text-[14px] text-warn">
          Switched on, but the Claude API key isn&apos;t set on the server yet, so CVs can&apos;t be read. Priyanshi adds it; nothing else is needed from you.
        </Card>
      ) : (
        <InboxUploader />
      )}

      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16.5px] font-semibold">
            Waiting to be checked <span className="font-normal text-muted">· {rows.length}</span>
          </h2>
          {on && keySet && waiting.length > 1 ? <ReadButton ids={waiting} label={`Read all ${waiting.length} not read yet`} variant="secondary" /> : null}
        </div>
        {rows.length ? (
          <Table head={["CV", "Read as", "Status", "Added", ""]}>
            {rows.map((r) => {
              const x = r.extracted as Partial<CvExtract> | null;
              const pqe = pqeYears(x?.qualified_on ?? null);
              const isStuck = stuck(r);
              const cells = (
                <>
                  <td className="max-w-[16rem]">
                    <span className="block truncate font-medium">{r.file_name}</span>
                  </td>
                  <td className="text-[13px]">
                    {x?.full_name ? (
                      <>
                        <span className="font-medium">{x.full_name}</span>
                        <span className="block text-muted">
                          {[[x.designation, x.current_firm].filter(Boolean).join(", "), pqe != null ? formatPqe(pqe) : ""].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="text-[13px]">
                    {r.status === "ready" ? (
                      <Badge tone="ok">Ready to check</Badge>
                    ) : r.status === "failed" ? (
                      <>
                        <Badge tone="danger">Couldn&apos;t read</Badge>
                        {r.error ? <span className="mt-1 block max-w-xs text-[12px] text-muted">{r.error}</span> : null}
                      </>
                    ) : r.status === "reading" && !isStuck ? (
                      <Badge tone="accent">Reading…</Badge>
                    ) : (
                      <Badge>Not read yet</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-[13px] text-muted">
                    {r.uploaded_by ? (team[r.uploaded_by] ?? "—") : "—"} · {ago(r.created_at)}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <span className="inline-flex items-center gap-1.5">
                      {r.status === "ready" ? (
                        <ButtonLink href={`/candidates/new?inbox=${r.id}`} size="sm" variant="primary">
                          Check and add
                        </ButtonLink>
                      ) : null}
                      {on && keySet && (r.status === "failed" || r.status === "uploaded" || isStuck) ? <ReadButton ids={[r.id]} label={r.status === "failed" ? "Try again" : "Read"} /> : null}
                      {r.status === "failed" ? (
                        <ButtonLink href={`/candidates/new?inbox=${r.id}`} size="sm" variant="ghost">
                          Add by hand
                        </ButtonLink>
                      ) : null}
                      <DiscardButton id={r.id} name={x?.full_name ?? r.file_name} />
                    </span>
                  </td>
                </>
              );
              return r.status === "ready" ? (
                <RowLink key={r.id} href={`/candidates/new?inbox=${r.id}`}>
                  {cells}
                </RowLink>
              ) : (
                <tr key={r.id}>{cells}</tr>
              );
            })}
          </Table>
        ) : (
          <Empty title="Nothing waiting">CVs you drop in show up here until each one is added as a candidate or removed.</Empty>
        )}
      </section>

      {saved.data?.length ? (
        <section>
          <h2 className="mb-2.5 text-[16.5px] font-semibold">Recently added from the inbox</h2>
          <Card className="divide-y divide-line">
            {saved.data.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                {s.candidate_id ? (
                  <Link href={`/candidates/${s.candidate_id}`} className="font-medium hover:text-accent">
                    {s.candidates?.full_name ?? s.file_name}
                  </Link>
                ) : (
                  <span className="text-muted">{s.file_name}</span>
                )}
                <span className="text-muted">{ago(s.updated_at)}</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {on ? (
        <p className="max-w-2xl text-[12px] text-muted">
          Each CV is sent to Anthropic&apos;s Claude API to be read; the file itself stays in your private storage. Check every detail against the CV before adding: AI can misread.
        </p>
      ) : null}
    </div>
  );
}
