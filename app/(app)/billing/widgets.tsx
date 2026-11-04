"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Dialog, Field, FormMessage, Input, Select, SubmitButton } from "@/components/form";
import type { ActionState } from "@/lib/forms";
import { cancelInvoice, markSent, raiseInvoice, recordPayment, updatePlacement } from "./actions";

export type PlacementRow = {
  id: string;
  name: string;
  status: string;
  offer_accepted_on: string | null;
  joining_date: string | null;
  annual_fixed_salary: number;
  fee_percent: number | null;
  left_on: string | null;
  left_reason: string | null;
  left_for_medical: boolean;
};

export function PlacementDialog({ p }: { p: PlacementRow }) {
  return (
    <Dialog
      title={`Placement: ${p.name}`}
      trigger={(open) => (
        <button type="button" onClick={open} className="text-[12px] text-accent hover:underline">
          Update
        </button>
      )}
    >
      {(close) => <PlacementForm p={p} close={close} />}
    </Dialog>
  );
}

function PlacementForm({ p, close }: { p: PlacementRow; close: () => void }) {
  const [status, setStatus] = useState(p.status);
  const [state, action] = useActionState(async (s: ActionState, fd: FormData) => {
    const r = await updatePlacement(s, fd);
    if (r?.ok) setTimeout(close, 1200);
    return r;
  }, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={p.id} />
      <FormMessage state={state} />
      <Field label="Status">
        <Select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="offer_accepted">Offer accepted, not joined yet</option>
          <option value="joined">Joined</option>
          <option value="backed_out">Backed out before joining</option>
          <option value="left_in_window">Left after joining</option>
          <option value="completed">Completed (replacement window over)</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Offer accepted on">
          <Input type="date" name="offer_accepted_on" defaultValue={p.offer_accepted_on ?? ""} />
        </Field>
        <Field label="Joining date">
          <Input type="date" name="joining_date" defaultValue={p.joining_date ?? ""} />
        </Field>
        <Field label="Monthly fixed salary (₹)" hint="No bonus or ESOPs. The fee uses this × 12.">
          <Input name="monthly_fixed_salary" inputMode="decimal" defaultValue={Math.round(p.annual_fixed_salary / 12)} />
        </Field>
        <Field label="Fee %" hint="Blank = from the agreement.">
          <Input name="fee_percent" inputMode="decimal" defaultValue={p.fee_percent ?? ""} />
        </Field>
      </div>
      {status === "left_in_window" ? (
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-warn-soft p-4">
          <Field label="Left on *">
            <Input type="date" name="left_on" required defaultValue={p.left_on ?? ""} />
          </Field>
          <Field label="Why">
            <Input name="left_reason" defaultValue={p.left_reason ?? ""} />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="left_for_medical" defaultChecked={p.left_for_medical} /> Left for medical reasons (no replacement under most agreements)
          </label>
        </div>
      ) : null}
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}

export function RaiseInvoiceButton({ placementId, urgent }: { placementId: string; urgent?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start">
      <Button
        size="sm"
        variant={urgent ? "primary" : "secondary"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await raiseInvoice(placementId);
            if (r?.error) setErr(r.error);
          })
        }
      >
        {pending ? "Raising…" : "Raise invoice"}
      </Button>
      {err ? <span className="mt-1 max-w-56 text-[12px] text-danger">{err}</span> : null}
    </span>
  );
}

export function InvoiceActions({ id, status, isAdmin }: { id: string; status: string; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" onClick={() => window.print()}>
        Print / save PDF
      </Button>
      {status === "draft" ? (
        <Button disabled={pending} onClick={() => start(async () => setErr((await markSent(id)).error ?? null))}>
          Mark as sent
        </Button>
      ) : null}
      {status === "sent" || status === "part_paid" ? <PaymentDialog invoiceId={id} /> : null}
      {isAdmin && status !== "cancelled" && status !== "paid" ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Cancel this invoice? The number stays used.")) start(async () => setErr((await cancelInvoice(id)).error ?? null));
          }}
        >
          Cancel invoice
        </Button>
      ) : null}
      {err ? <span className="text-[12px] text-danger">{err}</span> : null}
    </div>
  );
}

export function PaymentDialog({ invoiceId }: { invoiceId: string }) {
  return (
    <Dialog title="Record payment" trigger={(open) => <Button onClick={open}>Record payment</Button>}>
      {(close) => <PaymentForm invoiceId={invoiceId} close={close} />}
    </Dialog>
  );
}

function PaymentForm({ invoiceId, close }: { invoiceId: string; close: () => void }) {
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  const [state, action] = useActionState(async (s: ActionState, fd: FormData) => {
    const r = await recordPayment(s, fd);
    if (r?.ok) close();
    return r;
  }, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount received (₹) *">
          <Input name="amount" inputMode="decimal" required />
        </Field>
        <Field label="Received on">
          <Input type="date" name="received_on" defaultValue={today} />
        </Field>
      </div>
      <Field label="Reference" hint="UTR or cheque number.">
        <Input name="reference" />
      </Field>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
