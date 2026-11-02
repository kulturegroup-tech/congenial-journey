"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button, Dialog, Field, FormMessage, Input, Select, SubmitButton } from "@/components/form";
import { createClient } from "@/lib/supabase/client";
import { CITIES } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";
import {
  addEmail,
  addInterest,
  addPhone,
  addPriorApplication,
  addToMandate,
  cancelCall,
  cvLink,
  deleteRow,
  registerCv,
  scheduleCall,
} from "../actions";

type Opt = { id: string; label: string };

function ActionForm({
  action,
  children,
  submit,
  onDone,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit: string;
  onDone?: () => void;
}) {
  const [state, run] = useActionState(async (s: ActionState, fd: FormData) => {
    const r = await action(s, fd);
    if (r?.ok && onDone) onDone();
    return r;
  }, null);
  return (
    <form action={run} className="space-y-3">
      <FormMessage state={state} />
      {children}
      <SubmitButton>{submit}</SubmitButton>
    </form>
  );
}

export function ScheduleCall({ candidateId, mandates, team, me }: { candidateId: string; mandates: Opt[]; team: Opt[]; me: string }) {
  return (
    <Dialog title="Schedule a call" trigger={(open) => <Button onClick={open}>Schedule call</Button>}>
      {(close) => (
        <ActionForm action={scheduleCall} submit="Schedule" onDone={close}>
          <input type="hidden" name="candidate_id" value={candidateId} />
          <Field label="When (India time)">
            <Input type="datetime-local" name="when" required />
          </Field>
          <Field label="For mandate (optional)">
            <Select name="mandate_id" defaultValue="">
              <option value="">No specific mandate</option>
              {mandates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Who calls">
            <Select name="recruiter_id" defaultValue={me}>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function AddToMandate({ candidateId, mandates }: { candidateId: string; mandates: Opt[] }) {
  return (
    <Dialog title="Add to a mandate" trigger={(open) => <Button onClick={open}>Add to mandate</Button>}>
      {(close) => (
        <ActionForm action={addToMandate} submit="Add" onDone={close}>
          <input type="hidden" name="candidate_id" value={candidateId} />
          <Field label="Open mandate">
            <Select name="mandate_id" required defaultValue="">
              <option value="" disabled>
                Pick a mandate
              </option>
              {mandates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-[13px] text-muted">They start at &ldquo;Mapped&rdquo;. Move them along from the mandate&apos;s page.</p>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function AddContact({ candidateId }: { candidateId: string }) {
  return (
    <Dialog title="Add a phone or email" trigger={(open) => <Button size="sm" variant="ghost" onClick={open}>+ Add</Button>}>
      {() => (
        <div className="space-y-6">
          <ActionForm action={addPhone} submit="Add number">
            <input type="hidden" name="candidate_id" value={candidateId} />
            <Field label="Phone" hint="Any format. We check it isn't someone else's.">
              <Input name="phone" placeholder="98xxxxxx01" />
            </Field>
            <Field label="Came from">
              <Select name="source" defaultValue="manual">
                <option value="manual">Candidate / our records</option>
                <option value="weekday">Weekday</option>
              </Select>
            </Field>
          </ActionForm>
          <ActionForm action={addEmail} submit="Add email">
            <input type="hidden" name="candidate_id" value={candidateId} />
            <Field label="Email">
              <Input name="email" type="email" />
            </Field>
          </ActionForm>
        </div>
      )}
    </Dialog>
  );
}

export function AddInterest({ candidateId, firms, practices }: { candidateId: string; firms: string[]; practices: string[] }) {
  return (
    <Dialog title="What they want" trigger={(open) => <Button size="sm" variant="ghost" onClick={open}>+ Add</Button>}>
      {(close) => (
        <ActionForm action={addInterest} submit="Save" onDone={close}>
          <input type="hidden" name="candidate_id" value={candidateId} />
          <p className="text-[13px] text-muted">When a mandate opens that matches, whoever spoke to them gets an alert.</p>
          <Field label="Firm they want">
            <Input name="firm" list="interest-firms" autoComplete="off" />
            <datalist id="interest-firms">
              {firms.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input name="city" list="interest-cities" autoComplete="off" />
              <datalist id="interest-cities">
                {CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Practice area">
              <Select name="practice" defaultValue="">
                <option value="">Any</option>
                {practices.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Role">
            <Input name="role" placeholder="e.g. in-house counsel" />
          </Field>
          <Field label="Why we couldn't take them forward">
            <Input name="reason" />
          </Field>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function AddPrior({ candidateId, firms }: { candidateId: string; firms: string[] }) {
  return (
    <Dialog title="CV already sent to a firm" trigger={(open) => <Button size="sm" variant="ghost" onClick={open}>+ Add</Button>}>
      {(close) => (
        <ActionForm action={addPriorApplication} submit="Save" onDone={close}>
          <input type="hidden" name="candidate_id" value={candidateId} />
          <p className="text-[13px] text-muted">Used by the duplicate check before we share their CV with that firm.</p>
          <Field label="Firm">
            <Input name="firm" list="prior-firms" required autoComplete="off" />
            <datalist id="prior-firms">
              {firms.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="How">
              <Select name="route" defaultValue="job_portal">
                <option value="other_agency">Another agency</option>
                <option value="job_portal">Job portal</option>
                <option value="client_website">Firm&apos;s website</option>
                <option value="direct_email">Emailed someone at the firm</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="When" hint="Leave blank if unknown (treated as recent).">
              <Input type="date" name="applied_on" />
            </Field>
          </div>
          <Field label="Details">
            <Input name="details" />
          </Field>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function DeleteButton({ table, id, label = "Remove" }: { table: Parameters<typeof deleteRow>[0]; id: string; label?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteRow(table, id);
            setErr(r.error ?? null);
          })
        }
        className="text-[12px] text-faint hover:text-danger"
      >
        {pending ? "…" : label}
      </button>
      {err ? <span className="text-[12px] text-danger">{err}</span> : null}
    </span>
  );
}

export function CancelCall({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await cancelCall(id)))} className="text-[12px] text-faint hover:text-danger">
      {pending ? "…" : "Cancel"}
    </button>
  );
}

export function CvUpload({ candidateId }: { candidateId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${candidateId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("candidate-files").upload(path, file, { contentType: file.type || undefined });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    const r = await registerCv(candidateId, path, file.name, file.type);
    if (r.error) setErr(r.error);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <span>
      <input
        ref={input}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <Button size="sm" variant="ghost" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Uploading…" : "+ Upload CV"}
      </Button>
      {err ? <span className="ml-2 text-[12px] text-danger">{err}</span> : null}
    </span>
  );
}

export function CvOpen({ fileId, name }: { fileId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await cvLink(fileId);
        setBusy(false);
        if (r.url) window.open(r.url, "_blank", "noopener");
        else alert(r.error);
      }}
      className="text-left text-accent hover:underline"
    >
      {busy ? "Opening…" : name}
    </button>
  );
}

export function CallNotes({ notes }: { notes: [string, string | null][] }) {
  const shown = notes.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[13px] text-accent">Call notes</summary>
      <dl className="mt-2 grid gap-x-4 gap-y-2 text-[13px] md:grid-cols-[180px_1fr]">
        {shown.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="whitespace-pre-wrap">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

