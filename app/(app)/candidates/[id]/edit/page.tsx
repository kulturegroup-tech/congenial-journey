import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Page, PageHeader, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getFirmNames, getPracticeAreas, getTeam } from "@/lib/data/options";
import { pqeInput } from "@/lib/forms";
import { CandidateForm } from "../../candidate-form";

export const metadata: Metadata = { title: "Edit candidate" };

type Params = Promise<{ id: string }>;

export default function EditCandidatePage({ params }: { params: Params }) {
  return (
    <>
      <PageHeader title="Edit candidate" description="Phones and emails are managed on the profile." />
      <Page>
        <Suspense fallback={<TableSkeleton rows={4} />}>
          <EditForm params={params} />
        </Suspense>
      </Page>
    </>
  );
}

async function EditForm({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: c }, practices, firms, team] = await Promise.all([
    supabase.from("candidates").select("*, firms(name)").eq("id", id).maybeSingle(),
    getPracticeAreas(),
    getFirmNames(),
    getTeam(),
  ]);
  if (!c) notFound();
  return (
    <CandidateForm
      values={{
        id: c.id,
        full_name: c.full_name,
        linkedin_url: c.linkedin_url,
        current_firm: c.firms?.name ?? null,
        designation: c.designation,
        practice_areas: c.practice_areas ?? [],
        pqe: pqeInput(c.practice_start_date),
        current_city: c.current_city,
        preferred_cities: c.preferred_cities ?? [],
        graduation_year: c.graduation_year,
        current_ctc: c.current_ctc,
        expected_ctc: c.expected_ctc,
        notice_period_days: c.notice_period_days,
        source: c.source ?? undefined,
        owner_id: c.owner_id,
        review_note: c.review_note,
      }}
      practices={practices}
      firms={firms}
      team={team.filter((t) => t.active)}
    />
  );
}
