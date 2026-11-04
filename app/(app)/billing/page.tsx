import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Card, Empty, Page, PageHeader, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { daysSince, formatDate, formatLakhs, formatRupees } from "@/lib/format";
import { PlacementDialog, RaiseInvoiceButton } from "./widgets";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing" description="Placements, invoices and payments. Fees, GST and due dates come from each client's agreement." />
      <Page>
        <Suspense fallback={<TableSkeleton />}>
          <Billing />
        </Suspense>
      </Page>
    </>
  );
}

const statusTone = { offer_accepted: "accent", joined: "ok", backed_out: "neutral", left_in_window: "warn", completed: "ok" } as const;
const invTone = { draft: "warn", sent: "accent", part_paid: "warn", paid: "ok", cancelled: "neutral" } as const;

async function Billing() {
  const supabase = await createClient();
  const [pq, iq] = await Promise.all([
    supabase
      .from("placements")
      .select(
        "id, status, offer_accepted_on, joining_date, annual_fixed_salary, fee_percent, fee_amount, replacement_until, left_on, left_reason, left_for_medical, mandate_id, candidate_id, candidates(full_name), clients(display_name, gstin), mandates!placements_mandate_id_fkey(title, replaces_placement_id), agreements(invoice_deadline_days), invoices(id, invoice_number, status)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, total, due_on, raise_by, status, clients(display_name), placements(candidates(full_name)), payments(amount)")
      .order("invoice_date", { ascending: false }),
  ]);
  const placements = pq.data ?? [];
  const invoices = iq.data ?? [];

  const paidOf = (i: (typeof invoices)[number]) => i.payments.reduce((s, p) => s + Number(p.amount), 0);
  const open = invoices.filter((i) => i.status === "sent" || i.status === "part_paid");
  const outstanding = open.reduce((s, i) => s + Number(i.total) - paidOf(i), 0);
  const overdue = open.filter((i) => daysSince(i.due_on) > 0);
  const toRaise = placements.filter(
    (p) => ["joined", "left_in_window", "completed"].includes(p.status) && Number(p.fee_amount ?? 0) > 0 && !p.invoices.some((i) => i.status !== "cancelled"),
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="bg-sand p-5">
          <p className="text-[13px] text-muted">Outstanding</p>
          <p className="mt-1 font-display text-[36px] leading-tight tabular-nums">{formatRupees(outstanding)}</p>
          <p className="text-[12px] text-muted">{open.length} invoices sent and unpaid</p>
        </Card>
        <Card className="bg-clay p-5">
          <p className="text-[13px] text-muted">Overdue</p>
          <p className={`mt-1 font-display text-[36px] leading-tight tabular-nums ${overdue.length ? "text-danger" : ""}`}>
            {formatRupees(overdue.reduce((s, i) => s + Number(i.total) - paidOf(i), 0))}
          </p>
          <p className="text-[12px] text-muted">{overdue.length} past their due date</p>
        </Card>
        <Card className="bg-mist p-5">
          <p className="text-[13px] text-muted">Invoices to raise</p>
          <p className={`mt-1 font-display text-[36px] leading-tight tabular-nums ${toRaise.length ? "text-warn" : ""}`}>{toRaise.length}</p>
          <p className="text-[12px] text-muted">Joined, not yet invoiced</p>
        </Card>
      </div>

      <section>
        <h2 className="mb-2.5 text-[16.5px] font-semibold">Placements</h2>
        {placements.length ? (
          <Table head={["Candidate", "Client · mandate", "Salary", "Fee", "Joining", "Status", "Invoice"]}>
            {placements.map((p) => {
              const inv = p.invoices.find((i) => i.status !== "cancelled");
              const deadline = p.joining_date && p.agreements?.invoice_deadline_days != null ? p.agreements.invoice_deadline_days - daysSince(p.joining_date) : null;
              const needsInvoice = toRaise.some((t) => t.id === p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/candidates/${p.candidate_id}`} className="font-medium hover:text-accent">
                      {p.candidates?.full_name}
                    </Link>
                    <div>
                      <PlacementDialog
                        p={{
                          id: p.id,
                          name: p.candidates?.full_name ?? "",
                          status: p.status,
                          offer_accepted_on: p.offer_accepted_on,
                          joining_date: p.joining_date,
                          annual_fixed_salary: p.annual_fixed_salary,
                          fee_percent: p.fee_percent,
                          left_on: p.left_on,
                          left_reason: p.left_reason,
                          left_for_medical: p.left_for_medical,
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <Link href={`/mandates/${p.mandate_id}`} className="hover:text-accent">
                      {p.clients?.display_name} · {p.mandates?.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {formatRupees(Math.round(p.annual_fixed_salary / 12))}/mo
                    <div className="text-[12px] text-muted">{formatLakhs(p.annual_fixed_salary)} a year</div>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {p.fee_percent != null ? `${+p.fee_percent}% · ${formatRupees(p.fee_amount)}` : <span className="text-warn">No fee %: check the agreement</span>}
                    {p.mandates?.replaces_placement_id ? <div className="text-[12px] text-muted">Replacement, no fee</div> : null}
                  </td>
                  <td className="whitespace-nowrap">
                    {p.joining_date ? formatDate(p.joining_date) : "—"}
                    {p.replacement_until && p.status === "joined" ? <div className="text-[12px] text-muted">replacement until {formatDate(p.replacement_until)}</div> : null}
                  </td>
                  <td>
                    <Badge tone={statusTone[p.status]}>{p.status.replace(/_/g, " ")}</Badge>
                    {p.left_on ? <div className="text-[12px] text-muted">left {formatDate(p.left_on)}</div> : null}
                  </td>
                  <td className="whitespace-nowrap">
                    {inv ? (
                      <Link href={`/billing/invoices/${inv.id}`} className="hover:text-accent">
                        {inv.invoice_number} <Badge tone={invTone[inv.status]}>{inv.status.replace("_", " ")}</Badge>
                      </Link>
                    ) : needsInvoice ? (
                      <div>
                        <RaiseInvoiceButton placementId={p.id} urgent={deadline != null && deadline <= 7} />
                        {deadline != null ? (
                          <div className={`mt-1 text-[12px] ${deadline <= 7 ? "text-danger" : "text-muted"}`}>
                            {deadline >= 0 ? `${deadline} days left to invoice` : `deadline passed ${-deadline} days ago`}
                          </div>
                        ) : null}
                        {!p.clients?.gstin ? <div className="mt-1 text-[12px] text-warn">Add the client&apos;s GSTIN first</div> : null}
                      </div>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty title="No placements yet">Use “Offer accepted” on a pipeline card to record one.</Empty>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 text-[16.5px] font-semibold">Invoices</h2>
        {invoices.length ? (
          <Table head={["Invoice", "Client", "Candidate", "Date", "Total", "Received", "Due", "Status"]}>
            {invoices.map((i) => {
              const paid = paidOf(i);
              const late = (i.status === "sent" || i.status === "part_paid") && daysSince(i.due_on) > 0;
              return (
                <tr key={i.id}>
                  <td>
                    <Link href={`/billing/invoices/${i.id}`} className="font-semibold tabular-nums hover:text-accent">
                      {i.invoice_number}
                    </Link>
                  </td>
                  <td>{i.clients?.display_name}</td>
                  <td>{i.placements?.candidates?.full_name}</td>
                  <td className="whitespace-nowrap">{formatDate(i.invoice_date)}</td>
                  <td className="whitespace-nowrap tabular-nums">{formatRupees(i.total)}</td>
                  <td className="whitespace-nowrap tabular-nums">{paid ? formatRupees(paid) : "—"}</td>
                  <td className={`whitespace-nowrap ${late ? "font-medium text-danger" : ""}`}>{formatDate(i.due_on)}</td>
                  <td>
                    <Badge tone={late ? "danger" : invTone[i.status]}>{late ? "overdue" : i.status.replace("_", " ")}</Badge>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty title="No invoices yet" />
        )}
      </section>
    </div>
  );
}
