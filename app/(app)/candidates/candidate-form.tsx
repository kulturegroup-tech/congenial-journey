"use client";

import { useActionState } from "react";
import { ButtonLink, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Card } from "@/components/ui";
import { CITIES } from "@/lib/constants";
import { saveCandidate } from "./actions";

export type CandidateValues = {
  id?: string;
  full_name?: string;
  linkedin_url?: string | null;
  current_firm?: string | null;
  designation?: string | null;
  practice_areas?: string[];
  pqe?: string;
  current_city?: string | null;
  preferred_cities?: string[];
  graduation_year?: number | null;
  current_ctc?: number | null;
  expected_ctc?: number | null;
  notice_period_days?: number | null;
  source?: string;
  owner_id?: string | null;
  review_note?: string | null;
  phones?: string;
  emails?: string;
};

const toLakhs = (v: number | null | undefined) => (v == null ? "" : String(+(v / 100_000).toFixed(2)));

export function CandidateForm({
  values,
  practices,
  firms,
  team,
}: {
  values: CandidateValues;
  practices: string[];
  firms: string[];
  team: { id: string; full_name: string }[];
}) {
  const [state, action] = useActionState(saveCandidate, null);
  const isNew = !values.id;

  return (
    <form action={action} className="max-w-4xl space-y-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <FormMessage state={state} />

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="Full name *">
          <Input name="full_name" required defaultValue={values.full_name ?? ""} autoFocus={isNew} />
        </Field>
        <Field label="LinkedIn URL">
          <Input name="linkedin_url" defaultValue={values.linkedin_url ?? ""} placeholder="https://www.linkedin.com/in/…" />
        </Field>
        <Field label="Current firm" hint="Type to pick an existing firm; a new name is added as a firm.">
          <Input name="current_firm" list="firm-list" defaultValue={values.current_firm ?? ""} autoComplete="off" />
          <datalist id="firm-list">
            {firms.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label="Designation">
          <Input name="designation" defaultValue={values.designation ?? ""} placeholder="Associate, Senior Associate…" />
        </Field>
        <Field label="PQE today" hint="Years.months: 3.6 is 3 years 6 months. Kept current automatically.">
          <Input name="pqe" defaultValue={values.pqe ?? ""} placeholder="3.6" />
        </Field>
        <Field label="Graduation year">
          <Input name="graduation_year" type="number" min={1980} max={2040} defaultValue={values.graduation_year ?? ""} />
        </Field>
        <Field label="Current city">
          <Input name="current_city" list="city-list" defaultValue={values.current_city ?? ""} autoComplete="off" />
          <datalist id="city-list">
            {CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Open to cities" hint="Comma-separated.">
          <Input name="preferred_cities" defaultValue={(values.preferred_cities ?? []).join(", ")} />
        </Field>
      </Card>

      <Card className="p-5">
        <p className="mb-2 text-[13px] font-medium">Practice areas</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-4">
          {practices.map((p) => (
            <label key={p} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="practice_areas" value={p} defaultChecked={values.practice_areas?.includes(p)} />
              {p}
            </label>
          ))}
        </div>
      </Card>

      {isNew ? (
        <Card className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Phone numbers" hint="Any format; separate two numbers with a comma. We check for duplicates.">
            <Input name="phones" defaultValue={values.phones ?? ""} placeholder="98xxxxxx01, +91 98xxx xxx02" />
          </Field>
          <Field label="Number came from">
            <Select name="phone_source" defaultValue="manual">
              <option value="manual">Candidate / our records</option>
              <option value="weekday">Weekday</option>
            </Select>
          </Field>
          <Field label="Emails" hint="Comma-separated.">
            <Input name="emails" defaultValue={values.emails ?? ""} />
          </Field>
        </Card>
      ) : null}

      <Card className="grid gap-4 p-5 md:grid-cols-3">
        <Field label="Current CTC (lakhs)">
          <Input name="current_ctc" inputMode="decimal" defaultValue={toLakhs(values.current_ctc)} placeholder="24" />
        </Field>
        <Field label="Expected CTC (lakhs)">
          <Input name="expected_ctc" inputMode="decimal" defaultValue={toLakhs(values.expected_ctc)} placeholder="30" />
        </Field>
        <Field label="Notice period (days)">
          <Input name="notice_period_days" type="number" min={0} defaultValue={values.notice_period_days ?? ""} />
        </Field>
        <Field label="Source">
          <Select name="source" defaultValue={values.source ?? "linkedin_outreach"}>
            <option value="linkedin_outreach">LinkedIn outreach</option>
            <option value="inbound">Inbound email or DM</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Owner">
          <Select name="owner_id" defaultValue={values.owner_id ?? ""}>
            <option value="">Me</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note">
          <Textarea name="review_note" rows={1} defaultValue={values.review_note ?? ""} />
        </Field>
      </Card>

      <div className="flex gap-2">
        <SubmitButton>{isNew ? "Add candidate" : "Save changes"}</SubmitButton>
        <ButtonLink href={values.id ? `/candidates/${values.id}` : "/candidates"} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
