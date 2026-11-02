"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ButtonLink, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Card } from "@/components/ui";
import { saveClient } from "./actions";

export type ClientValues = {
  id?: string;
  firm?: string;
  kind?: string;
  display_name?: string;
  billing_name?: string | null;
  billing_address?: string | null;
  gstin?: string | null;
  owner_id?: string | null;
  notes?: string | null;
};

export function ClientForm({ values, firms, team }: { values: ClientValues; firms: string[]; team: { id: string; full_name: string }[] }) {
  const [state, action] = useActionState(saveClient, null);
  const v = values;
  return (
    <form action={action} className="max-w-3xl space-y-5">
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}
      {state?.error ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {state.error}{" "}
          {state.id ? (
            <Link href={`/clients/${state.id}`} className="font-medium underline">
              Open it
            </Link>
          ) : null}
        </p>
      ) : null}
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="Firm *" hint="Pick from the list if they're already in the database.">
          <Input name="firm" list="client-firms" required defaultValue={v.firm ?? ""} autoComplete="off" autoFocus={!v.id} />
          <datalist id="client-firms">
            {firms.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label="Short name" hint="How the team refers to them, e.g. JSA.">
          <Input name="display_name" defaultValue={v.display_name ?? ""} />
        </Field>
        <Field label="Type">
          <Select name="kind" defaultValue={v.kind ?? "law_firm"}>
            <option value="law_firm">Law firm</option>
            <option value="company">Company (in-house)</option>
          </Select>
        </Field>
        <Field label="Owner">
          <Select name="owner_id" defaultValue={v.owner_id ?? ""}>
            <option value="">Me</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </Select>
        </Field>
      </Card>
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="Billing name" hint="As it should appear on invoices.">
          <Input name="billing_name" defaultValue={v.billing_name ?? ""} />
        </Field>
        <Field label="GSTIN" hint="Starts with 27 → CGST + SGST. Anything else → IGST.">
          <Input name="gstin" defaultValue={v.gstin ?? ""} className="font-mono uppercase" maxLength={15} />
        </Field>
        <Field label="Billing address">
          <Textarea name="billing_address" rows={3} defaultValue={v.billing_address ?? ""} />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" rows={3} defaultValue={v.notes ?? ""} />
        </Field>
      </Card>
      <div className="flex gap-2">
        <SubmitButton>{v.id ? "Save changes" : "Add client"}</SubmitButton>
        <ButtonLink href={v.id ? `/clients/${v.id}` : "/clients"} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
