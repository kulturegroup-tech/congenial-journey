"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Download, LogOut } from "lucide-react";
import { Badge, Table } from "@/components/ui";
import { Button, Dialog, Input, SubmitButton, Textarea } from "@/components/form";
import { formatDate, formatPqe } from "@/lib/format";
import { PORTAL_STATUS, VERDICTS, VERDICT_SAID, verdictTone, type PortalShare, type PortalView } from "@/lib/portal-labels";
import { portalFeedback, portalSignIn, portalSignOut } from "./actions";

export function SignIn({ link, broken }: { link: string; broken?: boolean }) {
  const [state, action] = useActionState(portalSignIn.bind(null, link), null);
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-3xl bg-surface p-8 ring-1 ring-line">
      <h1 className="font-display text-[34px] leading-tight">Shared CVs</h1>
      {broken ? (
        <p className="mt-2 text-muted">This link doesn&apos;t work. Ask the person who sent it for a new one.</p>
      ) : (
        <>
          <p className="mt-1 text-muted">Type the 6-digit code you were sent with this link.</p>
          <form action={action} className="mt-6 space-y-3">
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Your 6-digit code"
              placeholder="000000"
              maxLength={7}
              autoFocus
              className="text-center text-[22px] tabular-nums tracking-[0.35em]"
            />
            {state?.error ? <p className="text-[13px] text-danger">{state.error}</p> : null}
            <SubmitButton pendingText="Checking…" className="w-full justify-center">
              Open
            </SubmitButton>
          </form>
          <p className="mt-6 text-[12px] text-faint">This page is private to you. Please don&apos;t forward the link or the code.</p>
        </>
      )}
    </div>
  );
}

const pqeText = (p: number | null) => (p != null ? `${formatPqe(p)} PQE` : null);

export function PortalList({ link, view }: { link: string; view: PortalView }) {
  const roles = useMemo(() => [...new Set(view.shares.map((s) => s.mandate))], [view.shares]);
  const [role, setRole] = useState<string>("");
  const [responding, setResponding] = useState<PortalShare | null>(null);
  const [exporting, setExporting] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const shares = role ? view.shares.filter((s) => s.mandate === role) : view.shares;
  const firm = view.firm || "Shared CVs";

  async function exportExcel() {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Shared CVs");
      ws.columns = [
        { header: "Candidate", key: "name", width: 26 },
        { header: "Current role", key: "designation", width: 22 },
        { header: "Current firm", key: "firm", width: 26 },
        { header: "PQE (years)", key: "pqe", width: 12 },
        { header: "City", key: "city", width: 14 },
        { header: "Practice", key: "practice", width: 30 },
        { header: "Role", key: "role", width: 30 },
        { header: "Shared on", key: "shared", width: 14 },
        { header: "Status", key: "status", width: 14 },
        { header: "Your view", key: "view", width: 18 },
        { header: "Your note", key: "note", width: 40 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const s of shares) {
        ws.addRow({
          name: s.name,
          designation: s.designation ?? "",
          firm: s.current_firm ?? "",
          pqe: s.pqe ?? "",
          city: s.city ?? "",
          practice: (s.practice_areas ?? []).join(", "),
          role: [s.mandate, s.mandate_city].filter(Boolean).join(", "),
          shared: formatDate(s.shared_at),
          status: PORTAL_STATUS[s.status] ?? s.status,
          view: s.feedback ? VERDICT_SAID[s.feedback.verdict] ?? s.feedback.verdict : "",
          note: s.feedback?.note ?? "",
        });
      }
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(view.client || "Shared CVs").replace(/[\\/:*?"<>|]+/g, " ")} - shared CVs - ${formatDate(new Date())}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[38px] leading-tight">{firm}</h1>
          <p className="text-muted">
            CVs shared with {view.contact ?? "you"}
            {view.client ? `, ${view.client}` : ""}, for the roles you&apos;re on. Tell us what you think of each one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view.shares.length ? (
            <Button variant="outline" onClick={exportExcel} disabled={exporting}>
              <Download size={15} /> {exporting ? "Making the file…" : "Export to Excel"}
            </Button>
          ) : null}
          <Button variant="ghost" disabled={signingOut} onClick={() => startSignOut(() => portalSignOut())}>
            <LogOut size={15} /> {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </header>

      {roles.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {["", ...roles].map((r) => (
            <button
              key={r || "all"}
              type="button"
              onClick={() => setRole(r)}
              className={`state rounded-full px-3 py-1.5 text-[13px] ${role === r ? "bg-accent text-white" : "bg-surface text-ink ring-1 ring-line"}`}
            >
              {r || `All roles (${view.shares.length})`}
            </button>
          ))}
        </div>
      ) : null}

      {shares.length ? (
        <Table head={["Candidate", "Experience", "Practice", "Role", "Shared", "Where it stands", "Your view"]}>
          {shares.map((s) => (
            <tr key={s.id}>
              <td>
                <span className="block font-semibold">{s.name}</span>
                <span className="block text-[12.5px] text-muted">{[s.designation, s.current_firm].filter(Boolean).join(", ") || "—"}</span>
              </td>
              <td className="whitespace-nowrap text-[13px]">
                {pqeText(s.pqe) ?? "—"}
                {s.city ? <span className="block text-muted">{s.city}</span> : null}
              </td>
              <td className="max-w-[220px] text-[13px]">{(s.practice_areas ?? []).join(", ") || "—"}</td>
              <td className="max-w-[220px] text-[13px]">
                {s.mandate}
                {s.mandate_city ? <span className="block text-muted">{s.mandate_city}</span> : null}
              </td>
              <td className="whitespace-nowrap text-[13px] text-muted">{formatDate(s.shared_at)}</td>
              <td>
                <Badge tone={s.status === "closed" ? "neutral" : s.status === "joined" ? "ok" : "accent"}>{PORTAL_STATUS[s.status] ?? s.status}</Badge>
              </td>
              <td className="min-w-[170px]">
                {s.feedback ? (
                  <>
                    <Badge tone={verdictTone(s.feedback.verdict)}>{VERDICT_SAID[s.feedback.verdict] ?? s.feedback.verdict}</Badge>
                    {s.feedback.note ? <span className="mt-1 block line-clamp-2 text-[12.5px] text-muted">{s.feedback.note}</span> : null}
                    <button type="button" className="mt-1 block text-[12.5px] text-accent hover:underline" onClick={() => setResponding(s)}>
                      Change
                    </button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setResponding(s)}>
                    Respond
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <div className="rounded-3xl bg-surface px-6 py-12 text-center ring-1 ring-line">
          <p className="font-medium">Nothing shared with you yet.</p>
          <p className="mt-1 text-[13px] text-muted">CVs we send you for your open roles will show here.</p>
        </div>
      )}

      <p className="mt-8 text-[12px] text-faint">
        Shared in confidence by {view.firm || "us"}. Please keep these details within your hiring team. You&apos;re signed in on this browser for 12 hours.
      </p>

      <Dialog title={responding ? `Your view on ${responding.name}` : ""} open={!!responding} onOpenChange={(v) => (v ? null : setResponding(null))}>
        {(close) => (responding ? <Respond link={link} share={responding} done={close} /> : null)}
      </Dialog>
    </>
  );
}

function Respond({ link, share, done }: { link: string; share: PortalShare; done: () => void }) {
  const [verdict, setVerdict] = useState<string>(share.feedback?.verdict ?? "");
  const [note, setNote] = useState(share.feedback?.note ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">
        {share.mandate}
        {share.mandate_city ? `, ${share.mandate_city}` : ""} · shared {formatDate(share.shared_at)}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Your view">
        {VERDICTS.map((v) => (
          <button
            key={v.value}
            type="button"
            role="radio"
            aria-checked={verdict === v.value}
            onClick={() => setVerdict(v.value)}
            className={`state rounded-full px-4 py-2 text-[13.5px] font-medium ring-1 ${verdict === v.value ? "bg-accent text-white ring-accent" : "bg-surface ring-line"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={4} placeholder="Anything we should know? Optional." />
      {err ? <p className="text-[13px] text-danger">{err}</p> : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={!verdict || pending}
          onClick={() =>
            start(async () => {
              const r = await portalFeedback(link, share.id, verdict, note);
              if (r.error) setErr(r.error);
              else done();
            })
          }
        >
          {pending ? "Sending…" : "Send"}
        </Button>
        <Button variant="ghost" onClick={done}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
