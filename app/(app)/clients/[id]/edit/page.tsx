import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Page, PageHeader, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getFirmNames, getTeam } from "@/lib/data/options";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Edit client" };

type Params = Promise<{ id: string }>;

export default function EditClientPage({ params }: { params: Params }) {
  return (
    <>
      <PageHeader title="Edit client" />
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
  const [{ data: c }, firms, team] = await Promise.all([
    supabase.from("clients").select("*, firms(name, kind)").eq("id", id).maybeSingle(),
    getFirmNames(),
    getTeam(),
  ]);
  if (!c) notFound();
  return (
    <ClientForm
      values={{ ...c, firm: c.firms?.name, kind: c.firms?.kind }}
      firms={firms}
      team={team.filter((t) => t.active)}
    />
  );
}
