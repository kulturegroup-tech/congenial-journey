"use client";

import { useActionState } from "react";
import { ButtonLink, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Card } from "@/components/ui";
import { CITIES } from "@/lib/constants";
import { saveMandate } from "./actions";

export type MandateValues = {
  id?: string;
  client_id?: string;
  title?: string;
  role_category?: string;
  practice_area?: string | null;
  pqe_min?: number | null;
  pqe_max?: number | null;
  grade_label?: string | null;
  city?: string | null;
  headcount?: number;
  received_on?: string;
  owner_id?: string | null;
  team_size?: string | null;
  team_structure?: string | null;
  client_profile?: string | null;
  work_profile?: string | null;
  soft_points?: string | null;
  pain_points?: string | null;
  research_notes?: string | null;
};

export function MandateForm({
  values,
  clients,
  practices,
  team,
  grades,
}: {
  values: MandateValues;
  clients: { id: string; display_name: string }[];
  practices: string[];
  team: { id: string; full_name: string }[];
  grades: string[];
}) {
  const [state, action] = useActionState(saveMandate, null);
  const v = values;
  return (
    <form action={action} className="max-w-4xl space-y-5">
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}
      <FormMessage state={state} />

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="Client *" hint={clients.length ? undefined : "Add the client under Clients first."}>
          <Select name="client_id" required defaultValue={v.client_id ?? ""}>
            <option value="" disabled>
              Pick a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title *" hint="The role in the client's words.">
          <Input name="title" required defaultValue={v.title ?? ""} placeholder="TMT associate" autoFocus={!v.id} />
        </Field>
        <Field label="Practice area">
          <Select name="practice_area" defaultValue={v.practice_area ?? ""}>
            <option value="">—</option>
            {practices.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="City">
          <Input name="city" list="mandate-cities" defaultValue={v.city ?? ""} autoComplete="off" />
          <datalist id="mandate-cities">
            {CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="PQE from">
            <Input name="pqe_min" inputMode="decimal" defaultValue={v.pqe_min ?? ""} placeholder="2" />
          </Field>
          <Field label="to">
            <Input name="pqe_max" inputMode="decimal" defaultValue={v.pqe_max ?? ""} placeholder="4" />
          </Field>
          <Field label="Firm grade">
            <Input name="grade_label" list="grade-list" defaultValue={v.grade_label ?? ""} placeholder="A1–A3" autoComplete="off" />
            <datalist id="grade-list">
              {grades.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Role type">
            <Select name="role_category" defaultValue={v.role_category ?? "legal"}>
              <option value="legal">Lawyer</option>
              <option value="support_staff">Support staff</option>
            </Select>
          </Field>
          <Field label="Openings">
            <Input name="headcount" type="number" min={1} defaultValue={v.headcount ?? 1} />
          </Field>
          <Field label="Received">
            <Input name="received_on" type="date" defaultValue={v.received_on ?? ""} />
          </Field>
        </div>
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

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Intake call</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Team size">
            <Input name="team_size" defaultValue={v.team_size ?? ""} />
          </Field>
          <Field label="Team structure">
            <Input name="team_structure" defaultValue={v.team_structure ?? ""} placeholder="Reports to…" />
          </Field>
          <Field label="Client profile">
            <Textarea name="client_profile" rows={2} defaultValue={v.client_profile ?? ""} />
          </Field>
          <Field label="Work profile">
            <Textarea name="work_profile" rows={2} defaultValue={v.work_profile ?? ""} />
          </Field>
          <Field label="Soft points (what they value)">
            <Textarea name="soft_points" rows={2} defaultValue={v.soft_points ?? ""} />
          </Field>
          <Field label="Pain points (why it's open)">
            <Textarea name="pain_points" rows={2} defaultValue={v.pain_points ?? ""} />
          </Field>
          <Field label="Research notes">
            <Textarea name="research_notes" rows={2} defaultValue={v.research_notes ?? ""} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-2">
        <SubmitButton>{v.id ? "Save changes" : "Create mandate"}</SubmitButton>
        <ButtonLink href={v.id ? `/mandates/${v.id}` : "/mandates"} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
