import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import { Badge, Card, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/member";
import { ActiveToggle, FirmForm, MemberDialog, PinForm, PracticeAreaForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Team, firm details for invoices, and defaults. Only admins can change the team and firm details."
        actions={<ButtonLink href="/settings/import">Import from Odoo / sheets</ButtonLink>}
      />
      <Page>
        <Suspense fallback={<TableSkeleton />}>
          <SettingsBody />
        </Suspense>
      </Page>
    </>
  );
}

async function SettingsBody() {
  const supabase = await createClient();
  const [session, team, settings, practices] = await Promise.all([
    getSession(),
    supabase.from("team_members").select("id, full_name, email, is_admin, active").order("active", { ascending: false }).order("full_name"),
    supabase.from("settings").select("*").single(),
    supabase.from("practice_areas").select("name").eq("active", true).order("sort"),
  ]);
  const me = session.state === "member" ? session.member : null;
  const isAdmin = !!me?.is_admin;

  return (
    <div className="max-w-4xl space-y-8">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Team</h2>
          {isAdmin ? <MemberDialog /> : null}
        </div>
        <Table head={["Name", "Email", "Role", ""]}>
          {(team.data ?? []).map((m) => (
            <tr key={m.id} className={m.active ? "" : "opacity-50"}>
              <td className="font-medium">
                {m.full_name} {m.id === me?.id ? <Badge>You</Badge> : null}
              </td>
              <td className="text-muted">{m.email}</td>
              <td>{m.is_admin ? <Badge tone="accent">Admin</Badge> : "Recruiter"}{m.active ? "" : " · inactive"}</td>
              <td className="whitespace-nowrap text-right">
                {isAdmin ? (
                  <span className="inline-flex gap-3">
                    <MemberDialog member={m} />
                    {m.id !== me?.id ? <ActiveToggle id={m.id} active={m.active} /> : null}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-[12px] text-muted">Deactivated members can&apos;t sign in to the workspace; their history stays.</p>
      </section>

      <section>
        <h2 className="mb-2.5 text-[16.5px] font-semibold">My PIN</h2>
        <Card className="p-4">
          <PinForm />
        </Card>
      </section>

      <section>
        <h2 className="mb-2.5 text-[16.5px] font-semibold">Firm details and defaults</h2>
        <Card className="p-5">{settings.data ? <FirmForm s={settings.data} canEdit={isAdmin} /> : <p className="text-muted">Couldn&apos;t load settings.</p>}</Card>
      </section>

      <section>
        <h2 className="mb-2.5 text-[16.5px] font-semibold">Practice areas</h2>
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap gap-1.5">
            {(practices.data ?? []).map((p) => (
              <Badge key={p.name}>{p.name}</Badge>
            ))}
          </div>
          <PracticeAreaForm />
        </Card>
      </section>
    </div>
  );
}
