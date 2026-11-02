import type { Metadata } from "next";
import { Suspense } from "react";
import { Page, PageHeader, TableSkeleton } from "@/components/ui";
import { getFirmNames, getTeam } from "@/lib/data/options";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="Add client" description="Then add their contacts and agreement terms on the client's page." />
      <Page>
        <Suspense fallback={<TableSkeleton rows={4} />}>
          <NewForm />
        </Suspense>
      </Page>
    </>
  );
}

async function NewForm() {
  const [firms, team] = await Promise.all([getFirmNames(), getTeam()]);
  return <ClientForm values={{}} firms={firms} team={team.filter((t) => t.active)} />;
}
