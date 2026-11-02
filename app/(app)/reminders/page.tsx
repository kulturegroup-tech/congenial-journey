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
        <Suspense fallback={<TableSkeleton />}>
          <ReminderList />
        </Suspense>
      </Page>
    </>
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
