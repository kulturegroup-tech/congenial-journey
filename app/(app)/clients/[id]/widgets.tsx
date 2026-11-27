"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button, Dialog, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { createClient } from "@/lib/supabase/client";
import type { ActionState } from "@/lib/forms";
import { agreementLink, attachAgreementFile, deleteContact, portalNewCode, portalTurnOff, portalTurnOn, saveAgreement, saveContact } from "../actions";
import { useToast } from "@/components/toast";
import { ago, formatDate, formatDateTime } from "@/lib/format";
import { AgreementFields } from "../agreement-fields";
import { openFile } from "@/lib/open-file";

function useCloseOnOk(action: (s: ActionState, fd: FormData) => Promise<ActionState>, close: () => void) {
  return useActionState(async (s: ActionState, fd: FormData) => {
    const r = await action(s, fd);
    if (r?.ok) close();
    return r;
  }, null);
}

export type Contact = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  copy_on_shares: boolean;
  notes: string | null;
};

export function ContactDialog({ clientId, contact }: { clientId: string; contact?: Contact }) {
  return (
    <Dialog
      title={contact ? `Edit ${contact.name}` : "Add contact"}
      trigger={(open) =>
        contact ? (
          <button type="button" onClick={open} className="text-[12px] text-accent hover:underline">
            Edit
          </button>
        ) : (
          <Button size="sm" variant="ghost" onClick={open}>
            + Add
          </Button>
        )
      }
    >
      {(close) => <ContactForm clientId={clientId} contact={contact} close={close} />}
    </Dialog>
  );
}

function ContactForm({ clientId, contact, close }: { clientId: string; contact?: Contact; close: () => void }) {
  const [state, action] = useCloseOnOk(saveContact, close);
  const c = contact;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="client_id" value={clientId} />
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *">
          <Input name="name" required defaultValue={c?.name ?? ""} autoFocus />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue={c?.role ?? "partner"}>
            <option value="partner">Partner</option>
            <option value="hr_ta">HR / TA</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={c?.email ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={c?.phone ?? ""} placeholder="For WhatsApp shares" />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={c?.city ?? ""} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="copy_on_shares" defaultChecked={c?.copy_on_shares} /> Copy them on every CV share
      </label>
      <Field label="Notes">
        <Textarea name="notes" rows={2} defaultValue={c?.notes ?? ""} />
      </Field>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}

export function RemoveContact({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setErr((await deleteContact(id)).error ?? null))}
        className="text-[12px] text-faint hover:text-danger"
      >
        {pending ? "…" : "Remove"}
      </button>
      {err ? <span className="ml-1 text-[12px] text-danger">{err}</span> : null}
    </>
  );
}

export type Agreement = {
  id: string;
  title: string;
  starts_on: string;
  ends_on: string | null;
  cooling_off_months: number;
  resume_validity_months: number;
  replacement_days: number;
  replacement_excludes_medical: boolean;
  invoice_deadline_days: number | null;
  payment_days: number;
  payment_from: string;
  requires_portal: boolean;
  portal_name: string | null;
  copy_ta_on_partner_shares: boolean;
  no_fee_if_backed_out: boolean;
  notes: string | null;
  fee_legal: number | null;
  fee_support_staff: number | null;
};

export function AgreementDialog({ clientId, agreement, label }: { clientId: string; agreement?: Agreement; label?: string }) {
  return (
    <Dialog
      wide
      title={agreement ? "Edit agreement" : "Add agreement"}
      trigger={(open) =>
        agreement ? (
          <button type="button" onClick={open} className="text-[12px] text-accent hover:underline">
            Edit
          </button>
        ) : (
          <Button size="sm" variant={label ? "primary" : "ghost"} onClick={open}>
            {label ?? "+ Add"}
          </Button>
        )
      }
    >
      {(close) => <AgreementForm clientId={clientId} a={agreement} close={close} />}
    </Dialog>
  );
}

function AgreementForm({ clientId, a, close }: { clientId: string; a?: Agreement; close: () => void }) {
  const [state, action] = useCloseOnOk(saveAgreement, close);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      {a ? <input type="hidden" name="id" value={a.id} /> : null}
      <FormMessage state={state} />
      <AgreementFields a={a} />
      <SubmitButton>Save agreement</SubmitButton>
    </form>
  );
}

export function AgreementFile({ clientId, agreementId, hasFile }: { clientId: string; agreementId: string; hasFile: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${clientId}/${agreementId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await createClient().storage.from("agreements").upload(path, file, { contentType: file.type || undefined });
    if (error) setErr(error.message);
    else {
      const r = await attachAgreementFile(agreementId, path);
      if (r.error) setErr(r.error);
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-3">
      {hasFile ? (
        <button
          type="button"
          onClick={async () => setErr(await openFile(() => agreementLink(agreementId)))}
          className="text-[12px] text-accent hover:underline"
        >
          Signed copy ↗
        </button>
      ) : null}
      <input ref={input} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="text-[12px] text-accent hover:underline">
        {busy ? "Uploading…" : hasFile ? "Replace PDF" : "Upload signed PDF"}
      </button>
      {err ? <span className="text-[12px] text-danger">{err}</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------- client portal

export type PortalRow = { contact_id: string; link_token: string; turned_off_at: string | null; last_seen_at: string | null; code_set_at: string; locked_until: string | null };

const portalUrl = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/portal/${token}`;

function portalStatus(a: PortalRow | null) {
  if (!a) return null;
  if (a.turned_off_at) return "Portal off";
  return `Portal on · ${a.last_seen_at ? `last opened ${ago(a.last_seen_at)}` : "not opened yet"}`;
}

/** A contact's portal: who can see it, and for admins, turning it on, new codes and turning it off. */
export function PortalAccess({ contact, access, isAdmin, onRoles }: { contact: { id: string; name: string }; access: PortalRow | null; isAdmin: boolean; onRoles: number }) {
  const status = portalStatus(access);
  if (!isAdmin) return status ? <span className="block text-[12.5px] text-muted">{status}</span> : null;
  return (
    <Dialog
      title={`Client portal for ${contact.name}`}
      trigger={(open) => (
        <button type="button" onClick={open} className="block text-left text-[12.5px] text-accent hover:underline">
          {status ? `${status} · Manage` : "Give portal access"}
        </button>
      )}
    >
      {(close) => <PortalPanel contact={contact} access={access} onRoles={onRoles} close={close} />}
    </Dialog>
  );
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // Clipboard blocked: the text is on screen to copy by hand.
        }
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

function PortalPanel({ contact, access, onRoles, close }: { contact: { id: string; name: string }; access: PortalRow | null; onRoles: number; close: () => void }) {
  const [fresh, setFresh] = useState<{ link: string; code: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const on = !!access && !access.turned_off_at;
  const first = contact.name.split(" ")[0];

  const make = (newLink: boolean) =>
    start(async () => {
      const r = await portalNewCode(contact.id, newLink);
      if ("error" in r) setErr(r.error);
      else {
        setErr(null);
        setFresh(r);
      }
    });

  const link = fresh ? portalUrl(fresh.link) : access ? portalUrl(access.link_token) : "";
  const message = fresh
    ? `Hi ${first}, here's your private page with the CVs we've shared with you for your open roles. You can tell us what you think of each one and export the list to Excel.\n\n${link}\n\nYour code: ${fresh.code}\n\nPlease don't forward the link or the code.`
    : "";

  return (
    <div className="space-y-4 text-[13.5px]">
      <p className="text-muted">
        {contact.name} opens a private link, types a 6-digit code, and sees the CVs shared for the roles they&apos;re on: name, current role and firm, PQE,
        city, practice, which role and where it stands. Never the CV file, phone, email or pay. They can mark each one Shortlist, Interview, Hold or Not a fit,
        and whoever owns the candidate gets a notification.
      </p>
      {onRoles === 0 ? <p className="rounded-2xl bg-warn-soft px-4 py-2.5 text-warn">They&apos;re not on any open role yet, so their page would be empty. Add them to a mandate first.</p> : null}

      {fresh ? (
        <div className="space-y-3 rounded-2xl bg-side/70 p-4">
          <div>
            <p className="mb-1 text-[12px] font-medium text-muted">Link</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 font-mono text-[12px]" />
              <Copy text={link} label="Copy link" />
            </div>
          </div>
          <div>
            <p className="mb-1 text-[12px] font-medium text-muted">Code</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[26px] tracking-[0.3em] tabular-nums">{fresh.code}</span>
              <Copy text={fresh.code} label="Copy code" />
            </div>
          </div>
          <p className="text-[12.5px] text-muted">
            The code shows only now. Best sent apart from the link (link by email, code on WhatsApp). Lost it? Make a new code any time.
          </p>
          <Copy text={message} label="Copy both as a message" />
        </div>
      ) : on ? (
        <div className="space-y-3 rounded-2xl bg-side/70 p-4">
          <div className="flex items-center gap-2">
            <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 font-mono text-[12px]" />
            <Copy text={link} label="Copy link" />
          </div>
          <p className="text-[12.5px] text-muted">
            Code made {formatDate(access!.code_set_at)}; it was shown only then. {access!.last_seen_at ? `Last opened ${formatDateTime(access!.last_seen_at)}.` : "Not opened yet."}
            {access!.locked_until && new Date(access!.locked_until) > new Date() ? ` Locked after 5 wrong codes until ${formatDateTime(access!.locked_until)}.` : ""}
          </p>
        </div>
      ) : null}

      {err ? <p className="text-danger">{err}</p> : null}

      <div className="flex flex-wrap gap-2">
        {!access ? (
          <Button variant="primary" disabled={pending} onClick={() => make(false)}>
            {pending ? "Making…" : "Turn the portal on"}
          </Button>
        ) : !on ? (
          <>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await portalTurnOn(contact.id);
                  if (r.error) setErr(r.error);
                  else close();
                })
              }
            >
              Turn back on (same link and code)
            </Button>
            <Button disabled={pending} onClick={() => make(false)}>
              Turn on with a new code
            </Button>
          </>
        ) : (
          <>
            <Button disabled={pending} onClick={() => make(false)}>
              {pending ? "Making…" : "New code"}
            </Button>
            <Button disabled={pending} onClick={() => make(true)} title="The old link stops working">
              New link and code
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await portalTurnOff(contact.id);
                  if (r.error) return setErr(r.error);
                  close();
                  toast({
                    message: `Portal turned off for ${contact.name}. They're signed out.`,
                    action: { label: "Undo", onClick: async () => void (await portalTurnOn(contact.id)) },
                  });
                })
              }
            >
              Turn off
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}
