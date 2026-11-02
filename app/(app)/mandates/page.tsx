import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, Empty, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTeamNames } from "@/lib/auth/member";
import { ago, formatDate, formatPqeRange } from "@/lib/format";

export const metadata: Metadata = { title: "Mandates" };

type BoardRow = {
  id: string;
  title: string;
  status: "active" | "on_hold" | "filled" | "lost";
  client: string;
  city: string | null;
  practice_area: string | null;
  pqe_min: number | null;
  pqe_max: number | null;
  grade_label: string | null;
  owner_id: string | null;
  received_on: string;
  last_activity_at: string;
  days_open: number;
  is_stale: boolean;
  in_play: number;
  cvs_shared: number;
  interviewed: number;
  joined: number;
};

export default function MandatesPage() {
  return (
    <>
      <PageHeader
        title="Mandates"
        description="Every open mandate with its owner and last activity. Stale ones rise to the top."
      />
      <Page>
        <Suspense fallback={<TableSkeleton />}>
          <MandateBoard />
        </Suspense>
      </Page>
    </>
  );
}

async function MandateBoard() {
  const supabase = await createClient();
  const [{ data, error }, team] = await Promise.all([
    supabase
      .from("v_mandate_board")
      .select("*")
      .in("status", ["active", "on_hold"])
      .order("is_stale", { ascending: false })
      .order("last_activity_at", { ascending: true }),
    getTeamNames(),
  ]);

  if (error) return <Empty title="Couldn't load mandates">{error.message}</Empty>;
  const rows = (data ?? []) as BoardRow[];
  if (rows.length === 0) {
    return <Empty title="No open mandates yet">New mandates show here with their owner and last activity.</Empty>;
  }

  return (
    <Table head={["Mandate", "City", "PQE", "Owner", "Received", "In play", "CVs shared", "Interviews", "Last activity"]}>
      {rows.map((m) => (
        <tr key={m.id}>
          <td>
            <div className="font-medium">{m.client}</div>
            <div className="text-muted">
              {m.title}
              {m.practice_area ? ` · ${m.practice_area}` : ""}
            </div>
          </td>
          <td>{m.city ?? "—"}</td>
          <td className="whitespace-nowrap">{formatPqeRange(m.pqe_min, m.pqe_max, m.grade_label)}</td>
          <td>{m.owner_id ? team[m.owner_id] ?? "—" : <span className="text-warn">Unassigned</span>}</td>
          <td className="whitespace-nowrap">
            {formatDate(m.received_on)}
            <div className="text-[12px] text-muted">{m.days_open} days open</div>
          </td>
          <td className="tabular-nums">{m.in_play}</td>
          <td className="tabular-nums">{m.cvs_shared}</td>
          <td className="tabular-nums">{m.interviewed}</td>
          <td className="whitespace-nowrap">
            {ago(m.last_activity_at)}
            <div className="mt-1 flex gap-1.5">
              {m.is_stale ? <Badge tone="warn">Stale</Badge> : null}
              {m.status === "on_hold" ? <Badge>On hold</Badge> : null}
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}
