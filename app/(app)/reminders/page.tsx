import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, Empty, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTeamNames } from "@/lib/auth/member";
import { ago, daysSince, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reminders" };

type Reminder = {
  kind: string;
  recipient_id: string | null;
  due_on: string | null;
  title: string;
  ref_id: string;
};

const kindLabel: Record<string, string> = {
  invoice_to_raise: "Raise invoice",
  payment_overdue: "Payment overdue",
  payment_due: "Payment due",
  replacement_window_ending: "Replacement window",
  follow_up: "Follow up",
  stale_mandate: "Stale mandate",
  call_today: "Call today",
  agreement_expiring: "Agreement ending",
};

export default function RemindersPage() {
  return (
    <>
      <PageHeader title="Reminders" description="Everything that needs someone today: calls, follow-ups, stale mandates, invoices and payments." />
      <Page>
        <section className="mb-8">
          <h2 className="mb-1 text-[15px] font-semibold">Past candidates who fit new mandates</h2>
          <p className="mb-3 text-muted">
            When a mandate opens or reopens, people we spoke to before are matched on the firm they asked for, practice
            area, city and PQE as of today. The alert goes to whoever spoke to them.
          </p>
          <Suspense fallback={<TableSkeleton rows={3} />}>
            <ReengagementList />
          </Suspense>
        </section>
        <h2 className="mb-3 text-[15px] font-semibold">Needs attention</h2>
        <Suspense fallback={<TableSkeleton />}>
          <ReminderList />
        </Suspense>
      </Page>
    </>
  );
}

type Alert = { id: string; title: string; body: string | null; recipient_id: string; created_at: string; read_at: string | null };

async function ReengagementList() {
  const supabase = await createClient();
  const [{ data, error }, team] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body, recipient_id, created_at, read_at")
      .eq("kind", "reengagement")
      .order("created_at", { ascending: false })
      .limit(25),
    getTeamNames(),
  ]);
  if (error) return <Empty title="Couldn't load alerts">{error.message}</Empty>;
  const rows = (data ?? []) as Alert[];
  if (rows.length === 0) return <Empty title="No matches yet">Matches appear here when a mandate opens.</Empty>;

  return (
    <Table head={["Match", "Why", "For", "When"]}>
      {rows.map((n) => (
        <tr key={n.id}>
          <td className="font-medium">{n.title}</td>
          <td>
            <div className="flex flex-wrap gap-1.5">
              {(n.body ?? "").split(" · ").filter(Boolean).map((reason) => (
                <Badge key={reason} tone={reason.startsWith("Asked for") ? "accent" : "neutral"}>
                  {reason}
                </Badge>
              ))}
            </div>
          </td>
          <td>{team[n.recipient_id] ?? "—"}</td>
          <td className="whitespace-nowrap text-muted">{ago(n.created_at)}</td>
        </tr>
      ))}
    </Table>
  );
}

async function ReminderList() {
  const supabase = await createClient();
  const [{ data, error }, team] = await Promise.all([
    supabase.from("v_reminders").select("kind, recipient_id, due_on, title, ref_id").order("due_on", { ascending: true }),
    getTeamNames(),
  ]);
  if (error) return <Empty title="Couldn't load reminders">{error.message}</Empty>;
  const rows = (data ?? []) as Reminder[];
  if (rows.length === 0) return <Empty title="Nothing needs attention">You&apos;re all caught up.</Empty>;

  return (
    <Table head={["Due", "What", "Type", "For"]}>
      {rows.map((r) => {
        const overdue = r.due_on ? daysSince(r.due_on) > 0 : false;
        return (
          <tr key={`${r.kind}:${r.ref_id}`}>
            <td className="whitespace-nowrap">
              <span className={overdue ? "font-medium text-danger" : ""}>{formatDate(r.due_on)}</span>
              <div className="text-[12px] text-muted">{r.due_on ? ago(r.due_on) : ""}</div>
            </td>
            <td>{r.title}</td>
            <td>
              <Badge tone={r.kind === "payment_overdue" || r.kind === "invoice_to_raise" ? "danger" : r.kind === "stale_mandate" ? "warn" : "neutral"}>
                {kindLabel[r.kind] ?? r.kind}
              </Badge>
            </td>
            <td>{r.recipient_id ? team[r.recipient_id] ?? "—" : "—"}</td>
          </tr>
        );
      })}
    </Table>
  );
}
