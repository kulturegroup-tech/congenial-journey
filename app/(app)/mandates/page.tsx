import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import {
  Badge,
  Empty,
  Page,
  PageHeader,
  Table,
  TableSkeleton,
} from "@/components/ui";
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

type SP = Promise<Record<string, string | string[] | undefined>>;

const tabs = [
  ["open", "Open"],
  ["filled", "Filled"],
  ["lost", "Lost"],
  ["all", "All"],
] as const;

export default function MandatesPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader
        title="Mandates"
        description="Every open mandate, who owns it and when there was last news. Quiet ones rise to the top."
        actions={
          <ButtonLink href="/mandates/new" variant="primary">
            New mandate
          </ButtonLink>
        }
      />
      <Page>
        <Suspense fallback={<TableSkeleton />}>
          <MandateBoard searchParams={searchParams} />
        </Suspense>
      </Page>
    </>
  );
}

async function MandateBoard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "open";
  const supabase = await createClient();
  let query = supabase.from("v_mandate_board").select("*");
  if (tab === "open") query = query.in("status", ["active", "on_hold"]);
  else if (tab === "filled" || tab === "lost") query = query.eq("status", tab);
  const [{ data, error }, team] = await Promise.all([
    query
      .order("is_stale", { ascending: false })
      .order("last_activity_at", { ascending: tab === "open" }),
    getTeamNames(),
  ]);
  const tabBar = (
    <div className="mb-5 inline-flex rounded-full bg-side p-1 text-[13px]">
      {tabs.map(([v, l]) => (
        <Link
          key={v}
          href={v === "open" ? "/mandates" : `/mandates?tab=${v}`}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${tab === v ? "bg-surface text-ink shadow-[0_4px_12px_-8px_rgb(29_42_36/0.5)]" : "text-muted hover:text-ink"}`}
        >
          {l}
        </Link>
      ))}
    </div>
  );

  if (error)
    return <Empty title="Couldn't load mandates">{error.message}</Empty>;
  const rows = (data ?? []) as BoardRow[];
  if (rows.length === 0) {
    return (
      <>
        {tabBar}
        <Empty title={tab === "open" ? "No open mandates" : "Nothing here"}>
          New mandates show here with their owner and last activity.
        </Empty>
      </>
    );
  }

  return (
    <>
      {tabBar}
      <Table
        head={[
          "Mandate",
          "City",
          "PQE",
          "Owner",
          "Received",
          "In play",
          "CVs shared",
          "Interviews",
          "Last activity",
        ]}
      >
        {rows.map((m) => (
          <tr key={m.id}>
            <td>
              <Link
                href={`/mandates/${m.id}`}
                className="font-medium hover:text-accent"
              >
                {m.client}
              </Link>
              <div className="text-muted">
                {m.title}
                {m.practice_area ? ` · ${m.practice_area}` : ""}
              </div>
            </td>
            <td>{m.city ?? "—"}</td>
            <td className="whitespace-nowrap">
              {formatPqeRange(m.pqe_min, m.pqe_max, m.grade_label)}
            </td>
            <td>
              {m.owner_id ? (
                (team[m.owner_id] ?? "—")
              ) : (
                <span className="text-warn">Unassigned</span>
              )}
            </td>
            <td className="whitespace-nowrap">
              {formatDate(m.received_on)}
              <div className="text-[12px] text-muted">
                {m.days_open} days open
              </div>
            </td>
            <td className="tabular-nums">{m.in_play}</td>
            <td className="tabular-nums">{m.cvs_shared}</td>
            <td className="tabular-nums">{m.interviewed}</td>
            <td className="whitespace-nowrap">
              {ago(m.last_activity_at)}
              <div className="mt-1 flex gap-1.5">
                {m.is_stale ? <Badge tone="warn">Quiet</Badge> : null}
                {m.status === "on_hold" ? <Badge>On hold</Badge> : null}
                {m.status === "filled" ? <Badge tone="ok">Filled</Badge> : null}
                {m.status === "lost" ? <Badge>Lost</Badge> : null}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
