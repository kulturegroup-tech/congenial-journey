import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Page, PageHeader, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getClients, getGradeLabels, getPracticeAreas, getTeam } from "@/lib/data/options";
import { MandateForm } from "../../mandate-form";

export const metadata: Metadata = { title: "Edit mandate" };

type Params = Promise<{ id: string }>;

export default function EditMandatePage({ params }: { params: Params }) {
  return (
    <>
      <PageHeader title="Edit mandate" />
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
  const [{ data: m }, clients, practices, team, grades] = await Promise.all([
    supabase.from("mandates").select("*").eq("id", id).maybeSingle(),
    getClients(),
    getPracticeAreas(),
    getTeam(),
    getGradeLabels(),
  ]);
  if (!m) notFound();
  return <MandateForm values={m} clients={clients} practices={practices} team={team.filter((t) => t.active)} grades={grades} />;
}
