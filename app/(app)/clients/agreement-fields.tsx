import { Field, Input, Select, Textarea } from "@/components/form";
import type { Agreement } from "./[id]/widgets";

/** The agreement terms, shared by the agreement dialog and the new-client form. */
export function AgreementFields({ a, optionalStart }: { a?: Agreement; optionalStart?: boolean }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Title">
          <Input name="title" defaultValue={a?.title ?? "Letter of engagement"} />
        </Field>
        <Field label={optionalStart ? "Starts" : "Starts *"} hint={optionalStart ? "Blank = today." : undefined}>
          <Input type="date" name="starts_on" required={!optionalStart} defaultValue={a?.starts_on ?? ""} />
        </Field>
        <Field label="Ends" hint="Blank = open-ended.">
          <Input type="date" name="ends_on" defaultValue={a?.ends_on ?? ""} />
        </Field>
      </div>
      <fieldset className="grid gap-3 rounded-2xl bg-side/70 p-4 md:grid-cols-4">
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
      <fieldset className="grid gap-3 rounded-2xl bg-side/70 p-4 md:grid-cols-4">
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
      <fieldset className="grid gap-3 rounded-2xl bg-side/70 p-4 md:grid-cols-3">
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
      <fieldset className="grid gap-3 rounded-2xl bg-side/70 p-4 md:grid-cols-3">
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
        <Textarea name="agreement_notes" rows={2} defaultValue={a?.notes ?? ""} />
      </Field>
    </>
  );
}
