"use client";

import Link from "@/components/fast-link";
import { BRAND_NAME } from "@/lib/brand";
import { useActionState, useEffect, useState } from "react";
import { Button, ButtonAnchor, Dialog, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { formatDate, formatLakhs, formatPqe } from "@/lib/format";
import { CONTACT_ROLE } from "@/lib/constants";
import { cvLink } from "../../candidates/actions";
import { openFile } from "@/lib/open-file";
import { resendShareEmail, shareContext, shareCv, type Finding, type ShareState } from "../actions";
import { coverNote, isPdfFile, makeCoverFile, saveBlob } from "./cover";

// The cover tick is remembered per browser (firms that always use it needn't tick it each time).
// The CTC tick always starts off.
const COVER_KEY = "covaro.share.cover";
const rememberedCover = () => {
  try {
    return localStorage.getItem(COVER_KEY) === "1";
  } catch {
    return false;
  }
};
// "Send from my Gmail" starts on once someone has connected Google, unless they turned it off here.
const GMAIL_KEY = "covaro.share.gmail";
const rememberedGmail = () => {
  try {
    return localStorage.getItem(GMAIL_KEY) !== "0";
  } catch {
    return true;
  }
};
const remember = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // Private mode: just don't remember.
  }
};

type EmailResult = NonNullable<NonNullable<ShareState>["email"]>;

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
  // The mandate's own contacts come first: the main one gets the CV, the others are copied,
  // along with anyone the client wants copied on every share.
  const pocs = ctx.mandateContacts.filter((cid) => ctx.contacts.some((x) => x.id === cid));
  const partners = ctx.contacts.filter((x) => x.role === "partner" || !x.copy_on_shares);
  const firstTo = pocs[0] ?? partners[0]?.id ?? ctx.contacts[0]?.id ?? "";
  const cc = [
    ...new Set([
      ...pocs.slice(1).map((cid) => ctx.contacts.find((x) => x.id === cid)?.email),
      ...ctx.contacts.filter((x) => x.copy_on_shares).map((x) => x.email),
    ]),
  ].filter((e): e is string => !!e && e !== ctx.contacts.find((x) => x.id === firstTo)?.email);
  const [toId, setToId] = useState(firstTo);
  const to = ctx.contacts.find((x) => x.id === toId);
  const [toEmail, setToEmail] = useState(to?.email ?? "");
  const [ccText, setCcText] = useState(cc.join(", "));
  const [fileId, setFileId] = useState(ctx.files[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const overrideReason = [reason, reasonNote.trim()].filter(Boolean).join(": ");
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[]>(["email", ...(ctx.agreement?.requires_portal ? ["portal"] : [])]);
  const [cover, setCover] = useState(rememberedCover);
  const [withMoney, setWithMoney] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverMsg, setCoverMsg] = useState<string | null>(null);
  const file = ctx.files.find((f) => f.id === fileId);
  const pickCover = (on: boolean) => {
    setCover(on);
    remember(COVER_KEY, on);
  };
  // Sending from the sharer's own Gmail, once they've connected Google in Settings.
  const canGmail = ctx.gmail.ready && !!ctx.gmail.email;
  const [gmailOn, setGmailOn] = useState(rememberedGmail);
  const pickGmail = (on: boolean) => {
    setGmailOn(on);
    remember(GMAIL_KEY, on);
  };
  const viaGmail = canGmail && gmailOn && channels.includes("email");
  const [retry, setRetry] = useState<{ busy: boolean; result: EmailResult | null }>({ busy: false, result: null });
  const previewCover = () =>
    openFile(async () => {
      const r = await makeCoverFile(ctx, fileId, withMoney);
      return "error" in r ? { error: r.error } : { url: URL.createObjectURL(r.blob) };
    }).then(setCoverMsg);
  const downloadCover = async () => {
    setCoverBusy(true);
    setCoverMsg(null);
    const r = await makeCoverFile(ctx, fileId, withMoney);
    setCoverBusy(false);
    if ("error" in r) return setCoverMsg(r.error);
    saveBlob(r.blob, r.fileName);
    if (!r.joined && r.reason && r.reason !== "no_cv") setCoverMsg(coverNote[r.reason]);
  };

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
      // The recruitment firm signs the note, not the product.
      ctx.firm ?? BRAND_NAME,
    ]
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n");
  });

  const blocking = ctx.findings.some((f) => f.blocking) || !!state?.blocked?.length;
  const toggle = (ch: string) => setChannels(channels.includes(ch) ? channels.filter((x) => x !== ch) : [...channels, ch]);
  const [subject, setSubject] = useState(`${c?.full_name} · ${ctx.mandate.title}${ctx.mandate.city ? `, ${ctx.mandate.city}` : ""}`);
  const mail = { to: toEmail, cc: ccText, subject, note, cover, withMoney };
  const mailto = `mailto:${encodeURIComponent(toEmail)}?${new URLSearchParams({ ...(ccText ? { cc: ccText } : {}), subject, body: note })
    .toString()
    .replace(/\+/g, "%20")}`;
  const waPhone = (to?.phone ?? "").replace(/\D/g, "");
  const whatsapp = `https://wa.me/${waPhone}?text=${encodeURIComponent(note)}`;

  if (state?.ok) {
    const email = retry.result ?? state.email ?? null;
    const sent = email?.sent ? email : null;
    const ccCount = ccText.split(/[,;\n]+/).filter((x) => x.trim()).length;
    const kept = (
      <>
        This CV stays ours at {ctx.mandate.client} until <b>{formatDate(state.validUntil!)}</b>.
      </>
    );
    const tryAgain = async () => {
      setRetry({ busy: true, result: null });
      const result = await resendShareEmail(state.shareId!, mail).catch(() => ({ sent: false as const, error: `Couldn't reach ${BRAND_NAME}. Check the internet and try again.` }));
      setRetry({ busy: false, result });
    };
    // Files to attach by hand: whenever the email didn't go from Gmail, and for WhatsApp.
    const handFiles = !sent || channels.includes("whatsapp");
    return (
      <div className="space-y-4">
        {sent ? (
          <p className="rounded-2xl bg-ok-soft px-4 py-2.5 text-ok">
            Sent from {sent.from || "your Gmail"} to {toEmail}
            {ccCount ? `, copying ${ccCount}` : ""}, {cover && isPdfFile(file) ? "with the CV attached and our cover page in front" : cover ? "with our cover page and the CV attached" : "with the CV attached"}.{" "}
            {kept}
          </p>
        ) : (
          <p className="rounded-2xl bg-ok-soft px-4 py-2.5 text-ok">Share logged. {kept}</p>
        )}
        {email && !email.sent ? (
          <p className="rounded-2xl bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
            The email didn&apos;t go: {email.error}
          </p>
        ) : null}
        {!sent ? (
          <p className="text-[13px] text-muted">
            {email ? "Try again, or send it yourself: attach" : "Now send it. Attach"} the {cover && isPdfFile(file) ? "PDF (cover and CV)" : cover ? "cover and the CV" : "CV"} to the
            email or WhatsApp; the note is filled in.
          </p>
        ) : channels.includes("whatsapp") ? (
          <p className="text-[13px] text-muted">For WhatsApp, attach the file yourself; the note is filled in.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {sent ? (
            <ButtonAnchor variant="primary" href={sent.url} target="_blank" rel="noreferrer">
              Open in Gmail
            </ButtonAnchor>
          ) : null}
          {email && !email.sent ? (
            <Button variant="primary" onClick={tryAgain} disabled={retry.busy}>
              {retry.busy ? "Sending…" : "Try again"}
            </Button>
          ) : null}
          {!sent && channels.includes("email") ? (
            email ? (
              <ButtonAnchor href={mailto}>Open email instead</ButtonAnchor>
            ) : (
              <a href={mailto} className="state inline-flex h-10 items-center rounded-full bg-accent px-4 font-medium text-white">
                Open email
              </a>
            )
          ) : null}
          {channels.includes("whatsapp") ? (
            <a href={whatsapp} target="_blank" rel="noreferrer" className="state inline-flex h-10 items-center rounded-full bg-accent px-4 font-medium text-white">
              Open WhatsApp
            </a>
          ) : null}
          {handFiles && cover ? (
            <Button onClick={downloadCover} disabled={coverBusy}>
              {coverBusy ? "Making the PDF…" : isPdfFile(file) ? "Download CV with cover" : "Download cover"}
            </Button>
          ) : null}
          {handFiles && fileId ? (
            <Button variant={cover ? "ghost" : "outline"} onClick={async () => setFileErr(await openFile(() => cvLink(fileId)))}>
              {cover && isPdfFile(file) ? "CV only" : "Download CV"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
        {fileErr ? <p className="text-[13px] text-danger">{fileErr}</p> : null}
        {coverMsg ? <p className="text-[13px] text-warn">{coverMsg}</p> : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="entry_id" value={entryId} />
      <input type="hidden" name="recipients" value={[toEmail && `To: ${toEmail}`, ccText && `CC: ${ccText}`].filter(Boolean).join("; ")} />
      {viaGmail ? (
        <>
          <input type="hidden" name="send_gmail" value="on" />
          <input type="hidden" name="to_email" value={toEmail} />
          <input type="hidden" name="cc_email" value={ccText} />
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="note" value={note} />
          {cover ? <input type="hidden" name="cover" value="on" /> : null}
          {cover && withMoney ? <input type="hidden" name="with_money" value="on" /> : null}
        </>
      ) : null}

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
                  {x.name} ({CONTACT_ROLE[x.role] ?? x.role}){pocs.includes(x.id) ? " · this role" : ""}
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

      {channels.includes("email") && canGmail ? (
        <div className="rounded-2xl bg-side/70 px-4 py-3 text-[13px]">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" checked={gmailOn} onChange={(e) => pickGmail(e.target.checked)} />
            Send it from my Gmail ({ctx.gmail.email})
          </label>
          {gmailOn && ctx.files.length ? (
            <p className="ml-6 mt-1 text-muted">
              Goes out when you press the button, with the {cover ? "cover and CV" : "CV"} attached, and sits in your Sent folder like any email you write. Replies come to
              you.
            </p>
          ) : null}
          {gmailOn && !ctx.files.length ? <p className="ml-6 mt-1 text-warn">There&apos;s no CV on file to attach. Upload it on their profile first, or untick this.</p> : null}
        </div>
      ) : channels.includes("email") && ctx.gmail.ready ? (
        <p className="text-[12px] text-muted">
          {ctx.gmail.broken ? "Your Google connection needs to be made again" : "Connect your Google account"} in{" "}
          <Link href="/settings#google" className="underline">
            Settings
          </Link>{" "}
          to send shares straight from your Gmail, with the CV attached.
        </p>
      ) : null}

      <div className="rounded-2xl bg-side/70 px-4 py-3 text-[13px]">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" checked={cover} onChange={(e) => pickCover(e.target.checked)} />
          Add our cover page
        </label>
        {cover ? (
          <div className="ml-6 mt-1.5 space-y-1.5">
            <p className="text-muted">
              One page in front of the CV with {ctx.logoPath ? "your logo" : "your firm's name"}, their experience, practice areas and highlights. No phone or
              email; those stay on the CV.
            </p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={withMoney} onChange={(e) => setWithMoney(e.target.checked)} />
              Show CTC and notice period on it
            </label>
            <button type="button" onClick={previewCover} className="font-medium text-accent underline underline-offset-2">
              Preview the cover
            </button>
            {!ctx.logoPath ? (
              <p className="text-[12px] text-muted">
                No logo yet: an admin can add it in{" "}
                <Link href="/settings#logo" className="underline">
                  Settings
                </Link>
                .
              </p>
            ) : null}
            {viaGmail && file && !isPdfFile(file) ? <p className="text-[12px] text-muted">The CV is a Word file, so the cover goes as a separate PDF beside it.</p> : null}
            {!ctx.highlights ? <p className="text-[12px] text-warn">No highlights for them yet. Add a few on their profile (Edit) so the cover says what stands out.</p> : null}
            {coverMsg ? <p className="text-[12px] text-danger">{coverMsg}</p> : null}
          </div>
        ) : null}
      </div>

      {channels.includes("email") ? (
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
      ) : null}
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
        <SubmitButton variant={blocking ? "danger" : "primary"} pendingText={viaGmail ? "Sending…" : "Checking…"}>
          {blocking ? "Send anyway" : viaGmail ? "Share and send email" : "Mark as shared"}
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
