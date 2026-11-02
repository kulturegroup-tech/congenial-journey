import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/form";
import { Badge, Card, Empty, Page, Table, TableSkeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTeamNames } from "@/lib/auth/member";
import { ago, formatDate, formatPqeRange } from "@/lib/format";
import { AgreementDialog, AgreementFile, ContactDialog, RemoveContact, type Agreement } from "./widgets";

export const metadata: Metadata = { title: "Client" };

type Params = Promise<{ id: string }>;

export default function ClientPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="p-8"><TableSkeleton /></div>}>
      <ClientScreen params={params} />
    </Suspense>
  );
}

const roleLabel: Record<string, string> = { partner: "Partner", hr_ta: "HR / TA", other: "Other" };

async function ClientScreen({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [cq, contacts, agreements, mandates, live, team] = await Promise.all([
    supabase.from("clients").select("*, firms(name, kind, aliases)").eq("id", id).maybeSingle(),
    supabase.from("client_contacts").select("*").eq("client_id", id).order("role").order("name"),
    supabase.from("agreements").select("*, agreement_fee_rates(role_category, fee_percent)").eq("client_id", id).order("starts_on", { ascending: false }),
    supabase.from("v_mandate_board").select("*").eq("client_id", id).order("received_on", { ascending: false }),
    supabase.from("v_live_submissions").select("*").eq("client_id", id).order("shared_at", { ascending: false }),
    getTeamNames(),
  ]);
  const c = cq.data;
  if (!c) notFound();

  const ags: (Agreement & { document_path: string | null })[] = (agreements.data ?? []).map((a) => ({
    ...a,
    fee_legal: a.agreement_fee_rates.find((r) => r.role_category === "legal")?.fee_percent ?? null,
    fee_support_staff: a.agreement_fee_rates.find((r) => r.role_category === "support_staff")?.fee_percent ?? null,
  }));

  return (
    <>
      <header className="border-b border-line bg-surface px-8 pb-5 pt-6">
        <Link href="/clients" className="text-[13px] text-muted hover:text-ink">
          ← Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{c.display_name}</h1>
            <p className="mt-1 text-muted">
              {[c.firms?.name !== c.display_name ? c.firms?.name : null, c.firms?.kind === "company" ? "In-house" : "Law firm", c.owner_id ? `owner ${team[c.owner_id] ?? "—"}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href={`/mandates/new?client=${id}`} variant="primary">
              New mandate
            </ButtonLink>
            <ButtonLink href={`/clients/${id}/edit`}>Edit</ButtonLink>
          </div>
        </div>
      </header>

      <Page>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">Agreement</h2>
                {ags.length ? <AgreementDialog clientId={id} /> : null}
              </div>
              {ags.length ? (
                <div className="space-y-3">
                  {ags.map((a, i) => (
                    <Card key={a.id} className={`p-4 ${i > 0 ? "opacity-70" : ""}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">
                          {a.title} {i === 0 ? <Badge tone="ok">Current</Badge> : <Badge>Earlier</Badge>}
                        </p>
                        <span className="flex items-center gap-3">
                          <AgreementFile clientId={id} agreementId={a.id} hasFile={!!a.document_path} />
                          <AgreementDialog clientId={id} agreement={a} />
                        </span>
                      </div>
                      <p className="text-[13px] text-muted">
                        From {formatDate(a.starts_on)}
                        {a.ends_on ? ` to ${formatDate(a.ends_on)}` : ", open-ended"}
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] md:grid-cols-3">
                        <div>
                          <dt className="text-muted">Fee</dt>
                          <dd>
                            {a.fee_legal != null ? `${+a.fee_legal}% lawyers` : "—"}
                            {a.fee_support_staff != null ? `, ${+a.fee_support_staff}% support staff` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Cooling-off</dt>
                          <dd>{a.cooling_off_months} months</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Resume validity</dt>
                          <dd>{a.resume_validity_months} months</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Replacement</dt>
                          <dd>
                            {a.replacement_days} days{a.replacement_excludes_medical ? ", not for medical exits" : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Invoice</dt>
                          <dd className={a.invoice_deadline_days ? "text-warn" : ""}>
                            {a.invoice_deadline_days ? `within ${a.invoice_deadline_days} days of joining` : "no deadline"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Payment</dt>
                          <dd>
                            {a.payment_days} days from {a.payment_from === "joining_date" ? "joining" : "invoice date"}
                          </dd>
                        </div>
                        {a.requires_portal || a.copy_ta_on_partner_shares ? (
                          <div className="col-span-full">
                            <dt className="text-muted">Sharing</dt>
                            <dd>
                              {[a.requires_portal ? `upload on ${a.portal_name ?? "their portal"}` : null, a.copy_ta_on_partner_shares ? "copy TA on partner shares" : null]
                                .filter(Boolean)
                                .join("; ")}
                            </dd>
                          </div>
                        ) : null}
                        {a.notes ? (
                          <div className="col-span-full">
                            <dt className="text-muted">Other terms</dt>
                            <dd className="whitespace-pre-wrap">{a.notes}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="flex flex-wrap items-center justify-between gap-3 border-warn/40 bg-warn-soft px-4 py-3">
                  <span className="text-[13px]">No agreement yet. Fees, the duplicate check and invoice deadlines fall back to defaults until you add one.</span>
                  <AgreementDialog clientId={id} label="Add agreement" />
                </Card>
              )}
            </section>

            <section>
              <h2 className="mb-2 font-semibold">Mandates</h2>
              {mandates.data?.length ? (
                <Table head={["Mandate", "PQE", "Owner", "Status", "Shared", "Last activity"]}>
                  {mandates.data.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/mandates/${m.id}`} className="font-medium hover:text-accent">
                          {m.title}
                        </Link>
                        <div className="text-[12px] text-muted">{[m.city, m.practice_area].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="whitespace-nowrap">{formatPqeRange(m.pqe_min, m.pqe_max, m.grade_label)}</td>
                      <td>{m.owner_id ? team[m.owner_id] ?? "—" : "—"}</td>
                      <td>
                        <Badge tone={m.status === "active" ? (m.is_stale ? "warn" : "accent") : m.status === "filled" ? "ok" : "neutral"}>
                          {m.is_stale ? "stale" : m.status?.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="tabular-nums">{m.cvs_shared}</td>
                      <td className="whitespace-nowrap text-muted">{m.last_activity_at ? ago(m.last_activity_at) : "—"}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <Empty title="No mandates yet" />
              )}
            </section>

            <section>
              <h2 className="mb-1 font-semibold">CVs still ours here</h2>
              <p className="mb-2 text-[12px] text-muted">If they hire any of these people before the date, the fee is due.</p>
              {live.data?.length ? (
                <Card className="divide-y divide-line text-[13px]">
                  {live.data.map((s) => (
                    <div key={s.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                      <span>
                        <Link href={`/candidates/${s.candidate_id}`} className="font-medium hover:text-accent">
                          {s.full_name}
                        </Link>{" "}
                        <span className="text-muted">for {s.mandate}</span> {s.placed ? <Badge tone="ok">Placed</Badge> : null}
                      </span>
                      <span className="text-muted">
                        shared {s.shared_at ? formatDate(s.shared_at) : "—"} · until <b className="text-ink">{s.valid_until ? formatDate(s.valid_until) : "—"}</b>
                      </span>
                    </div>
                  ))}
                </Card>
              ) : (
                <p className="text-[13px] text-muted">None.</p>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Contacts</h3>
                <ContactDialog clientId={id} />
              </div>
              {contacts.data?.length ? (
                <ul className="space-y-3 text-[13px]">
                  {contacts.data.map((p) => (
                    <li key={p.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">
                          {p.name} <span className="font-normal text-muted">· {roleLabel[p.role]}</span>
                        </span>
                        <span className="flex gap-2">
                          <ContactDialog clientId={id} contact={p} />
                          <RemoveContact id={p.id} />
                        </span>
                      </div>
                      {p.email ? (
                        <a href={`mailto:${p.email}`} className="block truncate text-muted hover:text-accent">
                          {p.email}
                        </a>
                      ) : null}
                      {p.phone ? <span className="block font-mono text-[12px] text-muted">{p.phone}</span> : null}
                      {p.copy_on_shares ? <Badge tone="accent">Copied on CV shares</Badge> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">No contacts yet.</p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="mb-2 font-semibold">Billing</h3>
              <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[13px]">
                <dt className="text-muted">Name</dt>
                <dd>{c.billing_name ?? "—"}</dd>
                <dt className="text-muted">GSTIN</dt>
                <dd className="font-mono">{c.gstin ?? "—"}</dd>
                <dt className="text-muted">Tax</dt>
                <dd>{c.gstin ? (c.gstin.startsWith("27") ? "CGST + SGST (Maharashtra)" : "IGST") : "Add GSTIN to invoice"}</dd>
                <dt className="text-muted">Address</dt>
                <dd className="whitespace-pre-wrap">{c.billing_address ?? "—"}</dd>
              </dl>
              {c.notes ? <p className="mt-3 whitespace-pre-wrap text-[13px] text-muted">{c.notes}</p> : null}
            </Card>
          </aside>
        </div>
      </Page>
    </>
  );
}
