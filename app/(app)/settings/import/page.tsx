import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Empty, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/member";
import { ago } from "@/lib/format";
import { ImportTool } from "./import-tool";
import { ReviewActions } from "./review";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import from Odoo and sheets"
        description="Loads candidates and their pipelines. Same LinkedIn, phone or email merges into the existing record; anything unclear goes to the review list."
      />
      <Page>
        <Suspense fallback={<TableSkeleton />}>
          <ImportBody />
        </Suspense>
      </Page>
    </>
  );
}

async function ImportBody() {
  const session = await getSession();
  if (session.state !== "member" || !session.member.is_admin) {
    return <Empty title="Admins only">Ask an admin to run imports.</Empty>;
  }
  const supabase = await createClient();
  const [mq, rq] = await Promise.all([
    supabase.from("mandates").select("id, title, city, status, clients(display_name)").order("received_on", { ascending: false }),
    supabase
      .from("import_rows")
      .select("id, batch, row_number, raw, issue, candidate_id, created_at, candidates(full_name)")
      .eq("status", "needs_review")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const mandates = (mq.data ?? []).map((m) => ({
    id: m.id,
    label: `${m.clients?.display_name ?? "?"} · ${m.title}${m.city ? ` (${m.city})` : ""}${m.status !== "active" ? ` [${m.status.replace("_", " ")}]` : ""}`,
  }));
  const reviews = rq.data ?? [];
  const dupIds = [...new Set(reviews.map((r) => (r.raw as Record<string, string>)?._possible_duplicate).filter(Boolean))];
  const { data: dups } = dupIds.length ? await supabase.from("candidates").select("id, full_name").in("id", dupIds) : { data: [] };
  const dupName = new Map((dups ?? []).map((d) => [d.id, d.full_name]));

  return (
    <div className="space-y-8">
      <ImportTool mandates={mandates} />

      <section>
        <h2 className="mb-1 font-semibold">Review list ({reviews.length})</h2>
        <p className="mb-2 text-[13px] text-muted">Possible duplicates, unreadable PQE, phones already on someone else, and rows that failed.</p>
        {reviews.length ? (
          <Table head={["Row", "Candidate", "Issue", ""]}>
            {reviews.map((r) => {
              const raw = (r.raw ?? {}) as Record<string, string>;
              const dup = raw._possible_duplicate ?? null;
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-[12px] text-muted">
                    {r.batch} · row {r.row_number}
                    <div>{ago(r.created_at)}</div>
                  </td>
                  <td>
                    {r.candidate_id ? (
                      <Link href={`/candidates/${r.candidate_id}`} className="font-medium hover:text-accent">
                        {r.candidates?.full_name ?? raw.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{raw.name || "—"}</span>
                    )}
                    {dup ? (
                      <div className="text-[12px]">
                        vs{" "}
                        <Link href={`/candidates/${dup}`} className="text-accent hover:underline">
                          {dupName.get(dup) ?? "existing record"}
                        </Link>
                      </div>
                    ) : null}
                  </td>
                  <td className="text-[13px]">{r.issue}</td>
                  <td className="text-right">
                    <ReviewActions rowId={r.id} candidateId={r.candidate_id} duplicateId={dup} duplicateName={dup ? dupName.get(dup) ?? null : null} />
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty title="Nothing to review" />
        )}
      </section>
    </div>
  );
}
