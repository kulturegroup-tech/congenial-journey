import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import { Badge, Empty, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTeamNames } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Each client's contacts and agreement terms: fees, cooling-off, resume validity, invoice deadlines."
        actions={<ButtonLink href="/clients/new" variant="primary">Add client</ButtonLink>}
      />
      <Page>
        <Suspense fallback={<TableSkeleton />}>
          <ClientList />
        </Suspense>
      </Page>
    </>
  );
}

const pct = (n: number) => `${+n}%`;

async function ClientList() {
  const supabase = await createClient();
  const [{ data, error }, team] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, display_name, gstin, owner_id, firms(name, kind), mandates(status), agreements(starts_on, ends_on, cooling_off_months, resume_validity_months, invoice_deadline_days, payment_days, document_path, agreement_fee_rates(role_category, fee_percent))",
      )
      .order("display_name"),
    getTeamNames(),
  ]);
  if (error) return <Empty title="Couldn't load clients">{error.message}</Empty>;
  if (!data?.length) return <Empty title="No clients yet">Add a client, then their contacts and agreement.</Empty>;

  return (
    <Table head={["Client", "Open mandates", "Fee", "Cooling-off / validity", "Invoice", "GST", "Owner"]}>
      {data.map((c) => {
        const a = [...c.agreements].sort((x, y) => y.starts_on.localeCompare(x.starts_on))[0];
        const open = c.mandates.filter((m) => m.status === "active" || m.status === "on_hold").length;
        const legal = a?.agreement_fee_rates.find((r) => r.role_category === "legal");
        const support = a?.agreement_fee_rates.find((r) => r.role_category === "support_staff");
        return (
          <tr key={c.id}>
            <td>
              <Link href={`/clients/${c.id}`} className="font-medium hover:text-accent">
                {c.display_name}
              </Link>
              <div className="text-[12px] text-muted">
                {c.firms?.name !== c.display_name ? c.firms?.name : null}
                {c.firms?.kind === "company" ? " · in-house" : ""}
              </div>
            </td>
            <td className="tabular-nums">{open || <span className="text-faint">0</span>}</td>
            <td className="whitespace-nowrap">
              {a ? (
                <>
                  {legal ? pct(legal.fee_percent) : "—"}
                  {support ? <span className="text-muted"> · support {pct(support.fee_percent)}</span> : null}
                </>
              ) : (
                <Badge tone="warn">No agreement</Badge>
              )}
            </td>
            <td className="whitespace-nowrap text-muted">{a ? `${a.cooling_off_months} mo / ${a.resume_validity_months} mo` : "—"}</td>
            <td className="whitespace-nowrap text-muted">
              {a ? (
                <>
                  {a.invoice_deadline_days ? <span className="text-warn">within {a.invoice_deadline_days}d of joining · </span> : null}
                  pay in {a.payment_days}d
                </>
              ) : (
                "—"
              )}
            </td>
            <td className="whitespace-nowrap">{c.gstin ? (c.gstin.startsWith("27") ? "CGST + SGST" : "IGST") : <span className="text-faint">No GSTIN</span>}</td>
            <td>{c.owner_id ? team[c.owner_id] ?? "—" : "—"}</td>
          </tr>
        );
      })}
    </Table>
  );
}
