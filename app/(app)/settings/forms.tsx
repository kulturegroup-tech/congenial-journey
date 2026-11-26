"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";
import { Button, Dialog, Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/form";
import type { ActionState } from "@/lib/forms";
import { addPracticeArea, changeMyPin, saveFirmSettings, saveMember, setCvReading, setLogo, setMemberActive } from "./actions";

export function MemberDialog({ member }: { member?: { full_name: string; email: string; is_admin: boolean } }) {
  return (
    <Dialog
      title={member ? `Edit ${member.full_name}` : "Add team member"}
      trigger={(open) =>
        member ? (
          <button type="button" onClick={open} className="text-[12px] text-accent hover:underline">
            Edit / reset PIN
          </button>
        ) : (
          <Button variant="primary" size="sm" onClick={open}>
            Add member
          </Button>
        )
      }
    >
      {() => <MemberForm member={member} />}
    </Dialog>
  );
}

function MemberForm({ member }: { member?: { full_name: string; email: string; is_admin: boolean } }) {
  const [state, action] = useActionState(saveMember, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field label="Name">
        <Input name="full_name" required defaultValue={member?.full_name ?? ""} autoFocus />
      </Field>
      <Field label="Email" hint={member ? undefined : "They sign in with this. Google sign-in works too once it's switched on."}>
        <Input name="email" type="email" required defaultValue={member?.email ?? ""} readOnly={!!member} />
      </Field>
      <Field label={member ? "New PIN (leave blank to keep)" : "PIN"} hint="6 to 12 digits. Tell them in person or on a call, not over email.">
        <Input name="pin" inputMode="numeric" pattern="[0-9]{6,12}" required={!member} autoComplete="off" />
      </Field>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="is_admin" defaultChecked={member?.is_admin} /> Admin (can manage the team, delete, change settings)
      </label>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setErr((await setMemberActive(id, !active)).error ?? null))}
        className={`text-[12px] hover:underline ${active ? "text-muted" : "text-accent"}`}
      >
        {pending ? "…" : active ? "Deactivate" : "Reactivate"}
      </button>
      {err ? <span className="ml-1 text-[12px] text-danger">{err}</span> : null}
    </>
  );
}

export function PinForm() {
  const [state, action] = useActionState(async (s: ActionState, fd: FormData) => changeMyPin(s, fd), null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="New PIN">
        <Input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" required className="w-40" autoComplete="new-password" />
      </Field>
      <Field label="Again">
        <Input name="pin2" type="password" inputMode="numeric" required className="w-40" autoComplete="new-password" />
      </Field>
      <SubmitButton>Change PIN</SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export type FirmSettings = {
  firm_name: string;
  address: string | null;
  gstin: string | null;
  bank_details: string | null;
  invoice_prefix: string;
  next_invoice_serial: number;
  invoice_fy: string | null;
  monthly_joining_target?: number;
  gst_rate: number;
  sac_code: string;
  stale_after_working_days: number;
  default_cooling_off_months: number;
  default_resume_validity_months: number;
};

export function FirmForm({ s, canEdit }: { s: FirmSettings; canEdit: boolean }) {
  const [state, action] = useActionState(saveFirmSettings, null);
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Firm name">
            <Input name="firm_name" defaultValue={s.firm_name} />
          </Field>
          <Field label="GSTIN" hint="Its first two digits are your state: clients in the same state are billed CGST + SGST, others IGST.">
            <Input name="gstin" defaultValue={s.gstin ?? ""} className="font-mono uppercase" maxLength={15} />
          </Field>
          <Field label="Address (printed on invoices)">
            <Textarea name="address" rows={3} defaultValue={s.address ?? ""} />
          </Field>
          <Field label="Bank details (printed on invoices)">
            <Textarea name="bank_details" rows={3} defaultValue={s.bank_details ?? ""} placeholder={"Account name\nBank, branch\nA/c no.\nIFSC"} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Invoice prefix">
            <Input name="invoice_prefix" defaultValue={s.invoice_prefix} />
          </Field>
          <Field
            label="Next invoice number"
            hint={`${s.invoice_fy ? `For ${s.invoice_fy}. ` : ""}Restarts at 1 every April. Numbers look like ${s.invoice_prefix}/2026-27/014.`}
          >
            <Input name="next_invoice_serial" type="number" min={1} defaultValue={s.next_invoice_serial} />
          </Field>
          <Field label="GST %">
            <Input name="gst_rate" inputMode="decimal" defaultValue={s.gst_rate} />
          </Field>
          <Field label="SAC code">
            <Input name="sac_code" defaultValue={s.sac_code} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Mandate goes quiet after (working days)">
            <Input name="stale_after_working_days" type="number" min={1} defaultValue={s.stale_after_working_days} />
          </Field>
          <Field label="Default cooling-off (months)" hint="When a client has no agreement yet.">
            <Input name="default_cooling_off_months" type="number" min={0} defaultValue={s.default_cooling_off_months} />
          </Field>
          <Field label="Joinings target each month" hint="Shown on Today for the whole team.">
            <Input name="monthly_joining_target" type="number" min={0} defaultValue={s.monthly_joining_target ?? 5} />
          </Field>
          <Field label="Default resume validity (months)">
            <Input name="default_resume_validity_months" type="number" min={0} defaultValue={s.default_resume_validity_months} />
          </Field>
        </div>
      </fieldset>
      <FormMessage state={state} />
      {canEdit ? <SubmitButton>Save</SubmitButton> : <p className="text-[13px] text-muted">Only an admin can change these.</p>}
    </form>
  );
}

export function PracticeAreaForm() {
  const [state, action] = useActionState(addPracticeArea, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Add a practice area">
        <Input name="name" className="w-64" />
      </Field>
      <SubmitButton variant="secondary">Add</SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CvReadingSwitch({ on, canEdit }: { on: boolean; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-3">
      <Button
        size="sm"
        variant={on ? "outline" : "primary"}
        disabled={!canEdit || pending}
        onClick={() => start(async () => setErr((await setCvReading(!on)).error ?? null))}
      >
        {pending ? "Saving…" : on ? "Turn off" : "Turn on"}
      </Button>
      {err ? <span className="text-[12px] text-danger">{err}</span> : null}
    </span>
  );
}

/** The firm's logo for CV cover pages. Uploaded straight to private storage; only admins change it. */
export function LogoForm({ path, canEdit }: { path: string | null; canEdit: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!path) return;
    let objectUrl: string | null = null;
    let live = true;
    createClient()
      .storage.from("branding")
      .download(path)
      .then(({ data }) => {
        if (!live || !data) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  async function upload(file: File) {
    setErr(null);
    if (!/^image\/(png|jpeg)$/.test(file.type)) return setErr("Use a PNG or JPG file.");
    if (file.size > 2 * 1024 * 1024) return setErr("Use a file under 2 MB.");
    setBusy(true);
    const storage = createClient().storage.from("branding");
    const next = `logo-${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await storage.upload(next, file, { contentType: file.type });
    if (error) {
      setBusy(false);
      return setErr("Upload failed. Check the internet and try again.");
    }
    const r = await setLogo(next);
    setBusy(false);
    if (r.error) return setErr(r.error);
    if (path) await storage.remove([path]); // the old one; harmless if it fails
    toast({ message: "Logo updated. New cover pages use it." });
  }

  async function remove() {
    if (!path) return;
    setBusy(true);
    const r = await setLogo(null);
    setBusy(false);
    if (r.error) return setErr(r.error);
    setUrl(null);
    toast({
      message: "Logo removed. Cover pages show the firm name instead.",
      action: { label: "Undo", onClick: async () => void (await setLogo(path)) },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="flex h-20 w-64 items-center justify-center rounded-2xl bg-canvas p-3">
        {path && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a private file shown from a blob URL
          <img src={url} alt="Firm logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[13px] text-faint">{path ? "Loading…" : "No logo yet"}</span>
        )}
      </div>
      <div className="space-y-2 text-[13px]">
        <p className="max-w-md text-muted">
          Goes at the top of the cover page put in front of a shared CV. PNG or JPG under 2 MB; a wide version on a white or clear background looks best.
        </p>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) upload(f);
              }}
            />
            <Button size="sm" variant="primary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Saving…" : path ? "Replace logo" : "Upload logo"}
            </Button>
            {path ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>
                Remove
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] text-muted">An admin can change it.</p>
        )}
        {err ? <p className="text-[12px] text-danger">{err}</p> : null}
      </div>
    </div>
  );
}
