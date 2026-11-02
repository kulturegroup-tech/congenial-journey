import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Page, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getFirmNames, getOpenMandates, getPracticeAreas } from "@/lib/data/options";
import { formatPqe } from "@/lib/format";
import { CallForm } from "./call-form";

export const metadata: Metadata = { title: "Screening call" };

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function CallPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <Suspense fallback={<div className="p-8"><TableSkeleton /></div>}>
      <CallScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function CallScreen({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: c }, mandates, firms, practices] = await Promise.all([
    supabase.from("v_candidates").select("id, full_name, current_firm, designation, pqe_today, current_city, notice_period_days, current_ctc, expected_ctc").eq("id", id).maybeSingle(),
    getOpenMandates(),
    getFirmNames(),
    getPracticeAreas(),
  ]);
  if (!c) notFound();

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-8 py-4 backdrop-blur">
        <Link href={`/candidates/${id}`} className="text-[13px] text-muted hover:text-ink">
          ← {c.full_name}
        </Link>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight">
          Screening call · {c.full_name}
          <span className="ml-2 text-[14px] font-normal text-muted">
            {[c.designation, c.current_firm, c.pqe_today != null ? `${formatPqe(c.pqe_today)} PQE` : null].filter(Boolean).join(" · ")}
          </span>
        </h1>
      </header>
      <Page>
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
      </Page>
    </>
  );
}
