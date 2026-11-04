"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Card } from "@/components/ui";
import { CITIES } from "@/lib/constants";
import { saveScreeningCall } from "../../actions";

type Opt = { id: string; label: string };
type Tag = { firm: string; city: string; practice: string; role: string };
type Prior = { firm: string; route: string; date: string; details: string };

const nowIst = () => {
  const d = new Date(Date.now() + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
};

const emptyTag: Tag = { firm: "", city: "", practice: "", role: "" };
const emptyPrior: Prior = { firm: "", route: "job_portal", date: "", details: "" };

export function CallForm({
  candidateId,
  scheduledId,
  mandateId,
  mandates,
  firms,
  practices,
  known,
}: {
  candidateId: string;
  scheduledId: string;
  mandateId: string;
  mandates: Opt[];
  firms: string[];
  practices: string[];
  known: { current_city: string; notice_period_days: string; current_ctc: string; expected_ctc: string };
}) {
  const [state, action] = useActionState(saveScreeningCall, null);
  const [tags, setTags] = useState<Tag[]>([{ ...emptyTag }]);
  const [priors, setPriors] = useState<Prior[]>([{ ...emptyPrior }]);
  const [outcome, setOutcome] = useState("");
  const form = useRef<HTMLFormElement>(null);

  const setTag = (i: number, k: keyof Tag, v: string) => setTags(tags.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const setPrior = (i: number, k: keyof Prior, v: string) => setPriors(priors.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  return (
    <form
      ref={form}
      action={action}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") form.current?.requestSubmit();
      }}
      className="max-w-5xl space-y-5"
    >
      <input type="hidden" name="candidate_id" value={candidateId} />
      {scheduledId ? <input type="hidden" name="scheduled_id" value={scheduledId} /> : null}
      <input type="hidden" name="interests" value={JSON.stringify(tags)} />
      <input type="hidden" name="priors" value={JSON.stringify(priors)} />

      <datalist id="call-firms">
        {firms.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <datalist id="call-cities">
        {CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <Card className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
        <Field label="For mandate" hint="Picking one puts them on that mandate at “Called”.">
          <Select name="mandate_id" defaultValue={mandateId}>
            <option value="">General call, no specific mandate</option>
            {mandates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="When (India time)">
          <Input type="datetime-local" name="called_at" defaultValue={nowIst()} />
        </Field>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="1 · Education">
          <Textarea name="education" rows={2} autoFocus placeholder="College, year" />
        </Field>
        <Field label="2 · Work history">
          <Textarea name="work_history" rows={2} placeholder="Firms and years" />
        </Field>
        <Field label="3 · Nature of work">
          <Textarea name="nature_of_work" rows={2} placeholder="Transactional, advisory, litigation…" />
        </Field>
        <Field label="4 · Industries and clients">
          <Textarea name="industries_clients" rows={2} />
        </Field>
        <Field label="5 · What they're looking for">
          <Textarea name="looking_for" rows={2} placeholder="In their words" />
        </Field>
        <Field label="6 · Team experience">
          <Textarea name="team_experience" rows={2} placeholder="Team size, who they report to" />
        </Field>
        <Field label="7 · Non-negotiables">
          <Textarea name="non_negotiables" rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="8 · Current city">
            <Input name="current_city" list="call-cities" defaultValue={known.current_city} autoComplete="off" />
          </Field>
          <Field label="9 · Notice (days)">
            <Input name="notice_period_days" type="number" min={0} defaultValue={known.notice_period_days} />
          </Field>
          <Field label="10 · Current CTC (L)">
            <Input name="current_ctc" inputMode="decimal" defaultValue={known.current_ctc} />
          </Field>
          <Field label="11 · Expected CTC (L)">
            <Input name="expected_ctc" inputMode="decimal" defaultValue={known.expected_ctc} />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[15.5px] font-semibold">5 · Firms, cities and roles they want</h3>
          <Button size="sm" variant="ghost" onClick={() => setTags([...tags, { ...emptyTag }])}>
            + Another
          </Button>
        </div>
        <p className="mb-3 text-[12px] text-muted">When a mandate opens that matches a row here, they show up as suggested for it.</p>
        <div className="space-y-2">
          {tags.map((t, i) => (
            <div key={i} className="grid grid-cols-[1.3fr_1fr_1.2fr_1.3fr_auto] gap-2">
              <Input placeholder="Firm" list="call-firms" value={t.firm} onChange={(e) => setTag(i, "firm", e.target.value)} autoComplete="off" />
              <Input placeholder="City" list="call-cities" value={t.city} onChange={(e) => setTag(i, "city", e.target.value)} autoComplete="off" />
              <Select value={t.practice} onChange={(e) => setTag(i, "practice", e.target.value)}>
                <option value="">Any practice</option>
                {practices.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <Input placeholder="Role, e.g. in-house" value={t.role} onChange={(e) => setTag(i, "role", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setTags(tags.length > 1 ? tags.filter((_, j) => j !== i) : [{ ...emptyTag }])}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <Field label="12 · Applications already made" hint="Anything they mention, in their words.">
          <Textarea name="applications_made" rows={2} />
        </Field>
        <div className="mb-1 mt-4 flex items-center justify-between">
          <h3 className="text-[15.5px] font-semibold">Where their CV has already gone</h3>
          <Button size="sm" variant="ghost" onClick={() => setPriors([...priors, { ...emptyPrior }])}>
            + Another
          </Button>
        </div>
        <p className="mb-3 text-[12px] text-muted">The duplicate check uses these before we share their CV with that firm.</p>
        <div className="space-y-2">
          {priors.map((p, i) => (
            <div key={i} className="grid grid-cols-[1.4fr_1.2fr_150px_1.3fr_auto] gap-2">
              <Input placeholder="Firm" list="call-firms" value={p.firm} onChange={(e) => setPrior(i, "firm", e.target.value)} autoComplete="off" />
              <Select value={p.route} onChange={(e) => setPrior(i, "route", e.target.value)}>
                <option value="other_agency">Another agency</option>
                <option value="job_portal">Job portal</option>
                <option value="client_website">Firm&apos;s website</option>
                <option value="direct_email">Emailed someone there</option>
                <option value="other">Other</option>
              </Select>
              <Input type="date" value={p.date} onChange={(e) => setPrior(i, "date", e.target.value)} title="Leave blank if unknown" />
              <Input placeholder="Details" value={p.details} onChange={(e) => setPrior(i, "details", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setPriors(priors.length > 1 ? priors.filter((_, j) => j !== i) : [{ ...emptyPrior }])}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="13 · Discussion">
          <Textarea name="discussion" rows={3} placeholder="Roles pitched, their reaction" />
        </Field>
        <Field label="14 · Action points">
          <Textarea name="action_points" rows={3} placeholder="Send CV by Friday, call back after appraisal…" />
        </Field>
      </Card>

      <Card className="space-y-3 p-5">
        <p className="text-[13px] font-medium">Outcome *</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["fit", "Fit: take forward"],
            ["not_fit", "Not a fit"],
            ["follow_up", "Follow up later"],
          ].map(([v, l]) => (
            <label
              key={v}
              className={`cursor-pointer rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${outcome === v ? "border-accent bg-accent text-white" : "border-line hover:bg-canvas"}`}
            >
              <input type="radio" name="outcome" value={v} className="sr-only" checked={outcome === v} onChange={() => setOutcome(v)} />
              {l}
            </label>
          ))}
        </div>
        {outcome === "not_fit" || outcome === "follow_up" ? (
          <Field label="Why we can't take them forward now" hint="Saved on the interest rows above, so the alert later tells you why.">
            <Input name="not_taken_reason" />
          </Field>
        ) : null}
      </Card>

      <FormMessage state={state} />
      <div className="flex items-center gap-3">
        <SubmitButton>Save call</SubmitButton>
        <span className="text-[12px] text-faint">Ctrl/⌘ + Enter saves</span>
      </div>
    </form>
  );
}
