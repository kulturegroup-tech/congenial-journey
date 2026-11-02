import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, Card, Page, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession, getTeamNames } from "@/lib/auth/member";
import { formatDate, formatMoney, rupeesInWords } from "@/lib/format";
import { InvoiceActions } from "../../widgets";

export const metadata: Metadata = { title: "Invoice" };

type Params = Promise<{ id: string }>;

export default function InvoicePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="p-8"><TableSkeleton /></div>}>
      <Invoice params={params} />
    </Suspense>
  );
}

async function Invoice({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [iq, sq, session, team] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "*, clients(display_name, billing_name, billing_address, gstin, state_code), payments(id, received_on, amount, reference), placements(joining_date, annual_fixed_salary, fee_percent, candidates(full_name), mandates!placements_mandate_id_fkey(title))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("settings").select("firm_name, address, gstin, sac_code, bank_details").single(),
    getSession(),
    getTeamNames(),
  ]);
  const inv = iq.data;
  if (!inv) notFound();
  const s = sq.data;
  const cl = inv.clients;
  const p = inv.placements;
  const paid = inv.payments.reduce((t, x) => t + Number(x.amount), 0);
  const isAdmin = session.state === "member" && session.member.is_admin;

  return (
    <>
      <header className="no-print border-b border-line bg-surface px-8 pb-5 pt-6">
        <Link href="/billing" className="text-[13px] text-muted hover:text-ink">
          ← Billing
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[22px] font-semibold tracking-tight">
            Invoice {inv.invoice_number} <Badge tone={inv.status === "paid" ? "ok" : inv.status === "cancelled" ? "neutral" : "accent"}>{inv.status.replace("_", " ")}</Badge>
          </h1>
          <InvoiceActions id={inv.id} status={inv.status} isAdmin={isAdmin} />
        </div>
        <p className="mt-1 text-[13px] text-muted">
          {inv.sent_at ? `Sent ${formatDate(inv.sent_at)}${inv.sent_by ? ` by ${team[inv.sent_by] ?? ""}` : ""} · ` : "Draft: print it, send it, then mark it as sent. · "}
          Due {formatDate(inv.due_on)}
          {inv.raise_by ? ` · agreement deadline to raise: ${formatDate(inv.raise_by)}` : ""}
          {paid ? ` · received ${formatMoney(paid)} of ${formatMoney(inv.total)}` : ""}
        </p>
      </header>

      <Page>
        <div className="print-sheet mx-auto max-w-[800px] rounded-xl border border-line bg-white p-10 text-[13px] text-black">
          <div className="flex justify-between gap-6">
            <div>
              <p className="text-[20px] font-semibold">{s?.firm_name ?? "Paradigm Shifters"}</p>
              <p className="mt-1 max-w-xs whitespace-pre-wrap text-neutral-600">{s?.address ?? "Address not set: add it in Settings"}</p>
              {s?.gstin ? <p className="mt-1">GSTIN: <span className="font-mono">{s.gstin}</span></p> : null}
            </div>
            <div className="text-right">
              <p className="text-[18px] font-semibold tracking-wide">TAX INVOICE</p>
              <p className="mt-2">
                Invoice no. <b className="font-mono">{inv.invoice_number}</b>
              </p>
              <p>Date: {formatDate(inv.invoice_date)}</p>
              <p>Due: {formatDate(inv.due_on)}</p>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-neutral-200 p-4">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Bill to</p>
            <p className="mt-1 font-semibold">{cl?.billing_name ?? cl?.display_name}</p>
            {cl?.billing_address ? <p className="whitespace-pre-wrap text-neutral-700">{cl.billing_address}</p> : null}
            {cl?.gstin ? (
              <p className="mt-1">
                GSTIN: <span className="font-mono">{cl.gstin}</span> · State code {cl.state_code}
              </p>
            ) : null}
          </div>

          <table className="mt-6 w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="py-2">Description</th>
                <th className="py-2">SAC</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-200 align-top">
                <td className="py-3">
                  Professional fee for recruitment services
                  <div className="text-neutral-600">
                    Candidate: {p?.candidates?.full_name} · {p?.mandates?.title}
                    {p?.joining_date ? ` · joined ${formatDate(p.joining_date)}` : ""}
                  </div>
                  {p ? (
                    <div className="text-neutral-600">
                      {+(p.fee_percent ?? 0)}% of annual fixed salary {formatMoney(p.annual_fixed_salary)}
                    </div>
                  ) : null}
                </td>
                <td className="py-3">{s?.sac_code ?? "9985"}</td>
                <td className="py-3 text-right tabular-nums">{formatMoney(inv.taxable_amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="ml-auto mt-4 w-72 space-y-1 tabular-nums">
            <div className="flex justify-between">
              <span>Taxable value</span>
              <span>{formatMoney(inv.taxable_amount)}</span>
            </div>
            {inv.tax === "cgst_sgst" ? (
              <>
                <div className="flex justify-between">
                  <span>CGST @ {+inv.gst_rate / 2}%</span>
                  <span>{formatMoney(inv.cgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST @ {+inv.gst_rate / 2}%</span>
                  <span>{formatMoney(inv.sgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>IGST @ {+inv.gst_rate}%</span>
                <span>{formatMoney(inv.igst)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-300 pt-1.5 text-[15px] font-semibold">
              <span>Total</span>
              <span>{formatMoney(inv.total)}</span>
            </div>
          </div>
          <p className="mt-3 text-right text-neutral-700">{rupeesInWords(Number(inv.total))}</p>

          <div className="mt-10 grid grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">Bank details</p>
              <p className="mt-1 whitespace-pre-wrap">{s?.bank_details ?? "Add bank details in Settings"}</p>
            </div>
            <div className="text-right">
              <p className="mt-10">For {s?.firm_name ?? "Paradigm Shifters"}</p>
              <p className="mt-10 text-neutral-500">Authorised signatory</p>
            </div>
          </div>
        </div>

        {inv.payments.length ? (
          <Card className="no-print mx-auto mt-6 max-w-[800px] p-4">
            <h3 className="mb-2 font-semibold">Payments</h3>
            <ul className="divide-y divide-line text-[13px]">
              {inv.payments.map((x) => (
                <li key={x.id} className="flex justify-between py-1.5">
                  <span>
                    {formatDate(x.received_on)} {x.reference ? <span className="text-muted">· {x.reference}</span> : null}
                  </span>
                  <span className="tabular-nums">{formatMoney(x.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </Page>
    </>
  );
}
