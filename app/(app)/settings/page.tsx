import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import { Badge, Card, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/member";
import { cvReaderKeySet } from "@/lib/ai/cv-reader";
import { AppearancePicker } from "@/components/theme";
import { googleConfig } from "@/lib/google/server";
import { ActiveToggle, CvReadingSwitch, FirmForm, GoogleConnect, LogoForm, MemberDialog, PinForm, PracticeAreaForm } from "./forms";

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
  const [session, team, settings, practices, google, syncState] = await Promise.all([
    getSession(),
    supabase.from("team_members").select("id, full_name, email, is_admin, active").order("active", { ascending: false }).order("full_name"),
    supabase.from("settings").select("*").single(),
    supabase.from("practice_areas").select("name").eq("active", true).order("sort"),
    supabase.from("google_connections").select("member_id, google_email, status, connected_at, calendar_sync"),
    supabase.from("calendar_sync_state").select("last_run_at, last_error").eq("id", true).maybeSingle(),
  ]);
  const me = session.state === "member" ? session.member : null;
  const isAdmin = !!me?.is_admin;
  const googleOf = new Map((google.data ?? []).map((g) => [g.member_id, g]));
  const myGoogle = me ? (googleOf.get(me.id) ?? null) : null;

  return (
    <div className="max-w-4xl space-y-8">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Team</h2>
          {isAdmin ? <MemberDialog /> : null}
        </div>
        <Table head={["Name", "Email", "Role", "Google", ""]}>
          {(team.data ?? []).map((m) => (
            <tr key={m.id} className={m.active ? "" : "opacity-50"}>
              <td className="font-medium">
                {m.full_name} {m.id === me?.id ? <Badge>You</Badge> : null}
              </td>
              <td className="text-muted">{m.email}</td>
              <td>{m.is_admin ? <Badge tone="accent">Admin</Badge> : "Recruiter"}{m.active ? "" : " · inactive"}</td>
              <td className="text-[13px]">
                {googleOf.get(m.id)?.status === "connected" ? (
                  <Badge tone="ok">Connected</Badge>
                ) : googleOf.get(m.id)?.status === "broken" ? (
                  <Badge tone="warn">Reconnect</Badge>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
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

      <section id="appearance" className="scroll-mt-24">
        <h2 className="mb-2.5 text-[16.5px] font-semibold">Appearance</h2>
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-md text-[13.5px] text-muted">Light, dark, or follow this computer&apos;s setting. Saved on this computer only, so each person picks their own.</p>
          <AppearancePicker />
        </Card>
      </section>

      <section id="google" className="scroll-mt-24">
        <h2 className="mb-2.5 text-[16.5px] font-semibold">Google account</h2>
        <Card className="space-y-3 p-5">
          <p className="max-w-2xl text-[13.5px] text-muted">
            Connect your work Google account so Covaro can send CV shares from your Gmail, show the emails with a candidate or client, and keep calls and
            interviews in step with your Google Calendar. Emails are read live from Gmail when you look; Covaro doesn&apos;t keep copies.
          </p>
          <GoogleConnect ready={!!googleConfig()} mine={myGoogle} lastSync={{ at: syncState.data?.last_run_at ?? null, error: syncState.data?.last_error ?? null }} />
        </Card>
      </section>

      <section id="logo" className="scroll-mt-24">
        <h2 className="mb-2.5 text-[16.5px] font-semibold">Logo</h2>
        <Card className="p-5">
          <LogoForm path={settings.data?.logo_path ?? null} canEdit={isAdmin} />
        </Card>
      </section>

      <section id="cv-reader" className="scroll-mt-24">
        <h2 className="mb-2.5 text-[16.5px] font-semibold">Reading CVs with AI</h2>
        <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="max-w-xl space-y-1.5 text-[13.5px]">
            <p>
              {settings.data?.ai_cv_reading ? <Badge tone="ok">On</Badge> : <Badge>Off</Badge>}{" "}
              {cvReaderKeySet() ? <span className="text-muted">Set up on the server.</span> : <span className="text-warn">Not set up on the server yet.</span>}
            </p>
            <p className="text-muted">
              When on, CVs dropped into the CV inbox are sent to an outside AI service, which reads out the name, contact details, firm, PQE,
              practice areas and a few highlights for the team to check. While off, nothing is sent.
            </p>
          </div>
          <CvReadingSwitch on={!!settings.data?.ai_cv_reading} canEdit={isAdmin} />
        </Card>
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
