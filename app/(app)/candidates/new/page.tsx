import type { Metadata } from "next";
import { Suspense } from "react";
import { Page, PageHeader, TableSkeleton } from "@/components/ui";
import { getFirmNames, getPracticeAreas, getTeam } from "@/lib/data/options";
import { CandidateForm } from "../candidate-form";

export const metadata: Metadata = { title: "Add candidate" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function NewCandidatePage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="Add candidate" description="We check phone, email and LinkedIn against everyone we already have before saving." />
      <Page>
        <Suspense fallback={<TableSkeleton rows={4} />}>
          <NewForm searchParams={searchParams} />
        </Suspense>
      </Page>
    </>
  );
}

async function NewForm({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  // Prefill from a failed lookup: a URL becomes LinkedIn, digits become a phone, an @ becomes an email, anything else a name.
  const prefill = /linkedin\.com\/in\//i.test(q)
    ? { linkedin_url: q }
    : /^[+\d][\d\s\-()]{7,}$/.test(q)
      ? { phones: q }
      : q.includes("@")
        ? { emails: q }
        : { full_name: q };
  const [practices, firms, team] = await Promise.all([getPracticeAreas(), getFirmNames(), getTeam()]);
  return <CandidateForm values={prefill} practices={practices} firms={firms} team={team.filter((t) => t.active)} />;
}
