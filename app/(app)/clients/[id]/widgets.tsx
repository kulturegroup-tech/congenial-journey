"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button, Dialog, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { createClient } from "@/lib/supabase/client";
import type { ActionState } from "@/lib/forms";
import { agreementLink, attachAgreementFile, deleteContact, saveAgreement, saveContact } from "../actions";

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
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Title">
          <Input name="title" defaultValue={a?.title ?? "Letter of engagement"} />
        </Field>
        <Field label="Starts *">
          <Input type="date" name="starts_on" required defaultValue={a?.starts_on ?? ""} />
        </Field>
        <Field label="Ends" hint="Blank = open-ended.">
          <Input type="date" name="ends_on" defaultValue={a?.ends_on ?? ""} />
        </Field>
      </div>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-4">
        <legend className="px-1 text-[13px] font-medium">Fees, % of annual fixed salary</legend>
        <Field label="Lawyers">
          <Input name="fee_legal" inputMode="decimal" defaultValue={a?.fee_legal ?? ""} placeholder="10" />
        </Field>
        <Field label="Support staff">
          <Input name="fee_support_staff" inputMode="decimal" defaultValue={a?.fee_support_staff ?? ""} placeholder="9" />
        </Field>
        <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-[13px]">
          <input type="checkbox" name="no_fee_if_backed_out" defaultChecked={a?.no_fee_if_backed_out ?? true} /> No fee if they back out before joining
        </label>
      </fieldset>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-4">
        <legend className="px-1 text-[13px] font-medium">Duplicates and replacement</legend>
        <Field label="Cooling-off (months)" hint="CV sent by anyone inside this = duplicate.">
          <Input name="cooling_off_months" type="number" min={0} defaultValue={a?.cooling_off_months ?? 6} />
        </Field>
        <Field label="Resume validity (months)" hint="Our CV stays ours this long.">
          <Input name="resume_validity_months" type="number" min={0} defaultValue={a?.resume_validity_months ?? 12} />
        </Field>
        <Field label="Replacement (days)">
          <Input name="replacement_days" type="number" min={0} defaultValue={a?.replacement_days ?? 90} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
          <input type="checkbox" name="replacement_excludes_medical" defaultChecked={a?.replacement_excludes_medical ?? true} /> Not if they leave for medical reasons
        </label>
      </fieldset>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-3">
        <legend className="px-1 text-[13px] font-medium">Invoicing</legend>
        <Field label="Raise invoice within (days of joining)" hint="Blank = no deadline. Trilegal: 30.">
          <Input name="invoice_deadline_days" type="number" min={0} defaultValue={a?.invoice_deadline_days ?? ""} />
        </Field>
        <Field label="Payment due in (days)">
          <Input name="payment_days" type="number" min={0} defaultValue={a?.payment_days ?? 15} />
        </Field>
        <Field label="Counted from">
          <Select name="payment_from" defaultValue={a?.payment_from ?? "invoice_date"}>
            <option value="invoice_date">Invoice date</option>
            <option value="joining_date">Joining date</option>
          </Select>
        </Field>
      </fieldset>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-3">
        <legend className="px-1 text-[13px] font-medium">Sharing CVs</legend>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="requires_portal" defaultChecked={a?.requires_portal} /> Must also upload on their portal
        </label>
        <Field label="Portal name">
          <Input name="portal_name" defaultValue={a?.portal_name ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="copy_ta_on_partner_shares" defaultChecked={a?.copy_ta_on_partner_shares} /> Copy TA team when sharing with partners
        </label>
      </fieldset>
      <Field label="Other terms">
        <Textarea name="notes" rows={2} defaultValue={a?.notes ?? ""} />
      </Field>
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
          onClick={async () => {
            const r = await agreementLink(agreementId);
            if (r.url) window.open(r.url, "_blank", "noopener");
            else setErr(r.error ?? null);
          }}
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
