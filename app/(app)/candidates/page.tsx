import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import { Badge, Empty, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getPracticeAreas } from "@/lib/data/options";
import { getTeamNames } from "@/lib/auth/member";
import { ago, formatPhone, formatPqe } from "@/lib/format";
import { CandidateFilters } from "./filters";

export const metadata: Metadata = { title: "Candidates" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function CandidatesPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader
        title="Candidates"
        description="Everyone we've mapped, called or placed. Search, filter, and open a profile."
        actions={
          <ButtonLink href="/candidates/new" variant="primary">
            Add candidate
          </ButtonLink>
        }
      />
      <Page>
        <Suspense fallback={<TableSkeleton />}>
          <Filtered searchParams={searchParams} />
        </Suspense>
      </Page>
    </>
  );
}

async function Filtered({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = {
    q: one(sp.q),
    practice: one(sp.practice),
    city: one(sp.city),
    seniority: one(sp.seniority),
    min: one(sp.min),
    max: one(sp.max),
  };
  const supabase = await createClient();
  let query = supabase
    .from("v_candidates")
    .select("id, full_name, current_firm, designation, practice_areas, pqe_today, seniority, current_city, phones, last_called_by, last_called_at, owner_id, review_note", { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, " ").trim();
    query = query.or(`full_name.ilike.%${term}%,current_firm.ilike.%${term}%,designation.ilike.%${term}%`);
  }
  if (f.practice) query = query.contains("practice_areas", [f.practice]);
  if (f.city) query = query.ilike("current_city", f.city);
  if (f.seniority) query = query.eq("seniority", f.seniority);
  if (f.min) query = query.gte("pqe_today", Number(f.min));
  if (f.max) query = query.lte("pqe_today", Number(f.max));

  const [{ data, error, count }, team, practices] = await Promise.all([query, getTeamNames(), getPracticeAreas()]);

  return (
    <div className="space-y-4">
      <CandidateFilters practices={practices} initial={f} />
      {error ? (
        <Empty title="Couldn't load candidates">{error.message}</Empty>
      ) : !data?.length ? (
        <Empty title="No candidates match">Try fewer filters, or add a candidate.</Empty>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            {count} candidate{count === 1 ? "" : "s"}
            {count && count > data.length ? `, showing the ${data.length} most recently updated` : ""}
          </p>
          <Table head={["Candidate", "Firm", "PQE", "Practice", "City", "Phone", "Last call"]}>
            {data.map((c) => (
              <tr key={c.id} className="hover:bg-canvas">
                <td>
                  <Link href={`/candidates/${c.id}`} className="font-medium hover:text-accent">
                    {c.full_name}
                  </Link>
                  {c.review_note === "Demo data" ? <span className="ml-2"><Badge>Demo</Badge></span> : null}
                  <div className="text-[12px] text-muted">{c.designation ?? ""}</div>
                </td>
                <td>{c.current_firm ?? <span className="text-faint">—</span>}</td>
                <td className="whitespace-nowrap">
                  {formatPqe(c.pqe_today)}
                  <div className="text-[12px] text-muted">{c.seniority ?? ""}</div>
                </td>
                <td className="max-w-48 text-[13px]">{(c.practice_areas ?? []).join(", ") || <span className="text-faint">—</span>}</td>
                <td>{c.current_city ?? <span className="text-faint">—</span>}</td>
                <td className="whitespace-nowrap font-mono text-[13px]">
                  {c.phones?.[0] ? formatPhone(c.phones[0]) : <span className="font-sans text-faint">No number</span>}
                </td>
                <td className="whitespace-nowrap">
                  {c.last_called_at ? (
                    <>
                      {team[c.last_called_by ?? ""] ?? "—"}
                      <div className="text-[12px] text-muted">{ago(c.last_called_at)}</div>
                    </>
                  ) : (
                    <span className="text-faint">Never</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}
