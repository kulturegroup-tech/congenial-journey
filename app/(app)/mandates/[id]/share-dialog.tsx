"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button, Dialog, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { formatDate, formatLakhs, formatPqe } from "@/lib/format";
import { cvLink } from "../../candidates/actions";
import { openFile } from "@/lib/open-file";
import { shareContext, shareCv, type Finding, type ShareState } from "../actions";

type Ctx = Awaited<ReturnType<typeof shareContext>>;
type Loaded = Exclude<Ctx, { error: string }>;

// Why a blocked share went through anyway. Picked from a list so the reasons can be counted later.
const OVERRIDE_REASONS = [
  "Client asked for this profile",
  "Client confirmed it isn't a duplicate",
  "Earlier application is older than the cooling-off period",
  "Candidate never actually applied there (wrong entry)",
  "Earlier application was for a different office or team, and the client is fine with it",
  "Other",
];

const ruleLabel: Record<string, string> = {
  prior_application: "Already applied",
  already_shared_by_us: "We've shared before",
  in_process_for_client: "Already in process",
  works_at_client: "Works there",
};

function Findings({ findings }: { findings: Finding[] }) {
  if (!findings.length) return <p className="rounded-2xl bg-ok-soft px-4 py-2.5 text-[13px] text-ok">No duplicate found for this client.</p>;
  const blocking = findings.some((f) => f.blocking);
  return (
    <div className={`rounded-2xl px-4 py-3 text-[13px] ${blocking ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>
      <p className="font-medium">{blocking ? "Duplicate: this CV already reached the client inside the cooling-off period." : "Worth knowing before you share:"}</p>
      <ul className="mt-1 list-disc pl-5">
        {findings.map((f, i) => (
          <li key={i}>
            <b>{ruleLabel[f.rule] ?? f.rule}:</b> {f.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pick the CV and channels, see the duplicate check, log the share, then open WhatsApp or email. */
export function ShareDialog({ entryId, onClose, onShared }: { entryId: string | null; onClose: () => void; onShared?: () => void }) {
  const [ctx, setCtx] = useState<{ id: string; data: Ctx } | null>(null);
  const loaded = ctx && ctx.id === entryId ? ctx.data : null;

  useEffect(() => {
    if (!entryId) return;
    let live = true;
    shareContext(entryId).then((data) => live && setCtx({ id: entryId, data }));
    return () => {
      live = false;
    };
  }, [entryId]);

  return (
    <Dialog title="Share CV" wide open={!!entryId} onOpenChange={(o) => !o && onClose()}>
      {() =>
        !loaded ? (
          <p className="py-8 text-center text-muted">Running the duplicate check…</p>
        ) : "error" in loaded ? (
          <p className="text-danger">{loaded.error}</p>
        ) : (
          <ShareForm key={entryId} entryId={entryId!} ctx={loaded} onClose={onClose} onShared={onShared} />
        )
      }
    </Dialog>
  );
}

function ShareForm({ entryId, ctx, onClose, onShared }: { entryId: string; ctx: Loaded; onClose: () => void; onShared?: () => void }) {
  const [state, action] = useActionState(async (s: ShareState, fd: FormData) => {
    const r = await shareCv(s, fd);
    if (r?.ok) onShared?.();
    return r;
  }, null);
  const c = ctx.candidate;
  const partners = ctx.contacts.filter((x) => x.role === "partner" || !x.copy_on_shares);
  const cc = ctx.contacts.filter((x) => x.copy_on_shares && x.email).map((x) => x.email!);
  const [toId, setToId] = useState(partners[0]?.id ?? ctx.contacts[0]?.id ?? "");
  const to = ctx.contacts.find((x) => x.id === toId);
  const [toEmail, setToEmail] = useState(to?.email ?? "");
  const [ccText, setCcText] = useState(ctx.agreement?.copy_ta_on_partner_shares || cc.length ? cc.join(", ") : "");
  const [fileId, setFileId] = useState(ctx.files[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const overrideReason = [reason, reasonNote.trim()].filter(Boolean).join(": ");
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[]>(["email", ...(ctx.agreement?.requires_portal ? ["portal"] : [])]);

  const firstName = to?.name.split(" ")[0] ?? "";
  const [note, setNote] = useState(() => {
    const bits = [
      c?.designation && c?.current_firm ? `${c.designation} at ${c.current_firm}` : c?.current_firm,
      c?.pqe_today != null ? `${formatPqe(c.pqe_today)} PQE` : null,
      c?.current_city,
    ].filter(Boolean);
    const money = [
      c?.current_ctc != null ? `current CTC ${formatLakhs(c.current_ctc)}` : null,
      c?.expected_ctc != null ? `expected ${formatLakhs(c.expected_ctc)}` : null,
      c?.notice_period_days != null ? `notice ${c.notice_period_days} days` : null,
    ].filter(Boolean);
    return [
      `Hi ${firstName || "there"},`,
      "",
      `Sharing the profile of ${c?.full_name} for the ${ctx.mandate.title} role${ctx.mandate.city ? ` (${ctx.mandate.city})` : ""}.`,
      bits.length ? `${bits.join(", ")}.` : "",
      money.length ? `${money.join(", ")}.` : "",
      "",
      "CV attached. Happy to set up a call.",
      "",
      "Regards,",
      "Paradigm Shifters",
    ]
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n");
  });

  const blocking = ctx.findings.some((f) => f.blocking) || !!state?.blocked?.length;
  const toggle = (ch: string) => setChannels(channels.includes(ch) ? channels.filter((x) => x !== ch) : [...channels, ch]);
  const subject = `${c?.full_name} · ${ctx.mandate.title}${ctx.mandate.city ? `, ${ctx.mandate.city}` : ""}`;
  const mailto = `mailto:${encodeURIComponent(toEmail)}?${new URLSearchParams({ ...(ccText ? { cc: ccText } : {}), subject, body: note })
    .toString()
    .replace(/\+/g, "%20")}`;
  const waPhone = (to?.phone ?? "").replace(/\D/g, "");
  const whatsapp = `https://wa.me/${waPhone}?text=${encodeURIComponent(note)}`;

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-ok-soft px-4 py-2.5 text-ok">
          Share logged. This CV stays ours at {ctx.mandate.client} until <b>{formatDate(state.validUntil!)}</b>.
        </p>
        <p className="text-[13px] text-muted">Now send it. Attach the CV to the email or WhatsApp yourself; the note is filled in.</p>
        <div className="flex flex-wrap gap-2">
          {channels.includes("email") ? (
            <a href={mailto} className="state inline-flex h-10 items-center rounded-full bg-accent px-4 font-medium text-white">
              Open email
            </a>
          ) : null}
          {channels.includes("whatsapp") ? (
            <a href={whatsapp} target="_blank" rel="noreferrer" className="state inline-flex h-10 items-center rounded-full bg-accent px-4 font-medium text-white">
              Open WhatsApp
            </a>
          ) : null}
          {fileId ? (
            <Button
              onClick={async () => setFileErr(await openFile(() => cvLink(fileId)))}
            >
              Download CV
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
        {fileErr ? <p className="text-[13px] text-danger">{fileErr}</p> : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="entry_id" value={entryId} />
      <input type="hidden" name="recipients" value={[toEmail && `To: ${toEmail}`, ccText && `CC: ${ccText}`].filter(Boolean).join("; ")} />

      <div>
        <p className="font-medium">
          {c?.full_name} → {ctx.mandate.client} · {ctx.mandate.title}
        </p>
      </div>
      <Findings findings={state?.blocked ?? ctx.findings} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="CV version">
          {ctx.files.length ? (
            <Select name="cv_file_id" value={fileId} onChange={(e) => setFileId(e.target.value)}>
              {ctx.files.map((f) => (
                <option key={f.id} value={f.id}>
                  v{f.version} · {f.file_name} · {formatDate(f.created_at)}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-[13px] text-warn">No CV uploaded yet. You can still log the share, or upload it on their profile first.</p>
          )}
        </Field>
        <div>
          <p className="mb-1 text-[13px] font-medium">Channels</p>
          <div className="flex flex-wrap gap-3 text-[13px]">
            {[
              ["email", "Email"],
              ["whatsapp", "WhatsApp"],
              ["portal", ctx.agreement?.portal_name ? `Portal (${ctx.agreement.portal_name})` : "Client portal"],
            ].map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="checkbox" name="channels" value={v} checked={channels.includes(v)} onChange={() => toggle(v)} />
                {l}
              </label>
            ))}
          </div>
          {ctx.agreement?.requires_portal ? <p className="mt-1 text-[12px] text-warn">The agreement says CVs go through their portal too.</p> : null}
        </div>
        <Field label="To">
          {ctx.contacts.length ? (
            <Select
              value={toId}
              onChange={(e) => {
                setToId(e.target.value);
                setToEmail(ctx.contacts.find((x) => x.id === e.target.value)?.email ?? "");
              }}
            >
              {ctx.contacts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.role === "hr_ta" ? "HR/TA" : x.role})
                </option>
              ))}
            </Select>
          ) : (
            <Input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="partner@firm.com" />
          )}
        </Field>
        <Field label="CC" hint={ctx.agreement?.copy_ta_on_partner_shares ? "The agreement asks us to copy the TA team." : undefined}>
          <Input value={ccText} onChange={(e) => setCcText(e.target.value)} placeholder="ta@firm.com" />
        </Field>
      </div>

      <Field label="Note">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={8} />
      </Field>

      {blocking ? (
        <div className="grid gap-3 rounded-2xl bg-danger-soft/60 p-4 md:grid-cols-2">
          <input type="hidden" name="override_reason" value={overrideReason} />
          <Field label="Share anyway? Pick the reason *" hint="Saved with the share, so the team can see why it went through.">
            <Select value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="" disabled>
                Pick a reason
              </option>
              {OVERRIDE_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label={reason === "Other" ? "What happened? *" : "Note"}>
            <Input value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} required={reason === "Other"} placeholder="Anything the team should know" />
          </Field>
        </div>
      ) : null}

      {state?.error ? <p className="rounded-2xl bg-danger-soft px-4 py-2.5 text-[13px] text-danger">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <SubmitButton variant={blocking ? "danger" : "primary"} pendingText="Checking…">
          {blocking ? "Send anyway" : "Mark as shared"}
        </SubmitButton>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <p className="text-[12px] text-faint">
        Logging the share moves them to “CV shared” and starts the resume-validity clock. <Link href="/reminders" className="underline">Reminders</Link> tracks follow-ups.
      </p>
    </form>
  );
}
