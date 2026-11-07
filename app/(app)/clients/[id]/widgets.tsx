"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button, Dialog, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { createClient } from "@/lib/supabase/client";
import type { ActionState } from "@/lib/forms";
import { agreementLink, attachAgreementFile, deleteContact, saveAgreement, saveContact } from "../actions";
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
