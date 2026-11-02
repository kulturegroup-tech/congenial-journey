import type { Metadata } from "next";
import { Suspense } from "react";
import { Page, PageHeader, TableSkeleton } from "@/components/ui";
import { getClients, getGradeLabels, getPracticeAreas, getTeam } from "@/lib/data/options";
import { MandateForm } from "../mandate-form";

export const metadata: Metadata = { title: "New mandate" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function NewMandatePage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="New mandate" description="Saving it checks every past candidate and alerts whoever spoke to the ones who fit." />
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
  const client = Array.isArray(sp.client) ? sp.client[0] : sp.client;
  const [clients, practices, team, grades] = await Promise.all([getClients(), getPracticeAreas(), getTeam(), getGradeLabels()]);
  return <MandateForm values={{ client_id: client }} clients={clients} practices={practices} team={team.filter((t) => t.active)} grades={grades} />;
}
