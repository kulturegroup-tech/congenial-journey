"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Button, Dialog, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Badge } from "@/components/ui";
import { STAGES, stageLabel } from "@/lib/constants";
import { ago, formatDate, formatPqe } from "@/lib/format";
import type { ActionState } from "@/lib/forms";
import { exitEntry, moveStage, recordPlacement, reopenEntry } from "../actions";
import { ShareDialog } from "./share-dialog";

export type Entry = {
  id: string;
  candidate_id: string;
  name: string;
  firm: string | null;
  pqe: number | null;
  stage: string;
  stage_changed_at: string;
  days_in_stage: number;
  exit_reason: string | null;
  exit_label: string | null;
  exit_note: string | null;
  follow_up_on: string | null;
  owner: string;
  has_share: boolean;
  placement: string | null;
};

const order = STAGES.map((s) => s.value as string);
const idx = (s: string) => order.indexOf(s);
const short: Record<string, string> = { confirmed: "CV received", offer: "Offer", doj_fixed: "DOJ fixed" };

export function Board({ entries, exitReasons }: { entries: Entry[]; exitReasons: { code: string; label: string }[] }) {
  const [optimistic, move] = useOptimistic(entries, (state, m: { id: string; stage: string }) =>
    state.map((e) => (e.id === m.id ? { ...e, stage: m.stage, days_in_stage: 0 } : e)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [share, setShare] = useState<{ id: string; then?: string } | null>(null);
  const [exiting, setExiting] = useState<Entry | null>(null);
  const [placing, setPlacing] = useState<Entry | null>(null);
  const [showExited, setShowExited] = useState(false);

  const active = optimistic.filter((e) => !e.exit_reason);
  const exited = optimistic.filter((e) => e.exit_reason);

  function goTo(e: Entry, stage: string) {
    setError(null);
    if (stage === e.stage) return;
    if (idx(stage) >= idx("cv_shared") && !e.has_share) {
      setShare({ id: e.id, then: stage });
      return;
    }
    start(async () => {
      move({ id: e.id, stage });
      const r = await moveStage(e.id, stage as never);
      if (r.error) setError(`${e.name}: ${r.error}`);
    });
  }

  function onDrop(stage: string) {
    const e = optimistic.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (!e) return;
    if (stage === "__exit") setExiting(e);
    else goTo(e, stage);
  }

  const col = (key: string) => ({
    onDragOver: (ev: React.DragEvent) => {
      ev.preventDefault();
      if (over !== key) setOver(key);
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (ev: React.DragEvent) => {
      ev.preventDefault();
      onDrop(key);
    },
  });

  return (
    <div>
      {error ? (
        <p className="mb-3 flex justify-between rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
          <button type="button" onClick={() => setError(null)}>
            ✕
          </button>
        </p>
      ) : null}

      <div className="-mx-8 overflow-x-auto px-8 pb-3">
        <div className="flex gap-2.5">
          {STAGES.map((s) => {
            const cards = active.filter((e) => e.stage === s.value);
            return (
              <div
                key={s.value}
                {...col(s.value)}
                className={`flex w-[200px] shrink-0 flex-col rounded-xl border p-2 transition-colors ${
                  over === s.value ? "border-accent bg-accent-soft" : "border-line bg-canvas"
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{short[s.value] ?? s.label}</span>
                  <span className="text-[12px] tabular-nums text-faint">{cards.length || ""}</span>
                </div>
                <div className="min-h-16 space-y-2">
                  {cards.map((e) => (
                    <Card
                      key={e.id}
                      e={e}
                      dragging={dragId === e.id}
                      onDragStart={() => setDragId(e.id)}
                      onNext={() => goTo(e, order[idx(e.stage) + 1])}
                      onShare={() => setShare({ id: e.id })}
                      onExit={() => setExiting(e)}
                      onPlace={() => setPlacing(e)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <div
            {...col("__exit")}
            className={`flex w-[150px] shrink-0 items-center justify-center rounded-xl border border-dashed p-2 text-center text-[13px] ${
              over === "__exit" ? "border-danger bg-danger-soft text-danger" : "border-line text-faint"
            }`}
          >
            Drop here to take them out of the running
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button type="button" onClick={() => setShowExited(!showExited)} className="text-[13px] font-medium text-muted hover:text-ink">
          {showExited ? "▾" : "▸"} Out of the running ({exited.length})
        </button>
        {showExited && exited.length ? (
          <div className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
            {exited.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[13px]">
                <span>
                  <Link href={`/candidates/${e.candidate_id}`} className="font-medium hover:text-accent">
                    {e.name}
                  </Link>{" "}
                  <span className="text-muted">
                    · left at {stageLabel(e.stage)} · {e.exit_label ?? e.exit_reason}
                    {e.exit_note ? ` · “${e.exit_note}”` : ""}
                    {e.follow_up_on ? ` · follow up ${formatDate(e.follow_up_on)}` : ""}
                  </span>
                </span>
                <ReopenButton id={e.id} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <ShareDialog
        entryId={share?.id ?? null}
        onClose={() => setShare(null)}
        onShared={() => {
          const then = share?.then;
          const e = optimistic.find((x) => x.id === share?.id);
          if (e && then && idx(then) > idx("cv_shared")) start(async () => void (await moveStage(e.id, then as never)));
        }}
      />
      <ExitDialog entry={exiting} reasons={exitReasons} onClose={() => setExiting(null)} />
      <PlaceDialog entry={placing} onClose={() => setPlacing(null)} />
    </div>
  );
}

function Card({
  e,
  dragging,
  onDragStart,
  onNext,
  onShare,
  onExit,
  onPlace,
}: {
  e: Entry;
  dragging: boolean;
  onDragStart: () => void;
  onNext: () => void;
  onShare: () => void;
  onExit: () => void;
  onPlace: () => void;
}) {
  const days = e.days_in_stage;
  const canShare = idx(e.stage) <= idx("cv_shared");
  const canPlace = idx(e.stage) >= idx("offer") && !e.placement && e.stage !== "joined";
  return (
    <div
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className={`cursor-grab rounded-lg border border-line bg-surface p-2.5 shadow-sm active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}
    >
      <Link href={`/candidates/${e.candidate_id}`} className="block font-medium leading-tight hover:text-accent" draggable={false}>
        {e.name}
      </Link>
      <p className="mt-0.5 truncate text-[12px] text-muted">{[e.firm, e.pqe != null ? `${formatPqe(e.pqe)}` : null].filter(Boolean).join(" · ") || "—"}</p>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-faint">
        <span title={`In this stage since ${ago(e.stage_changed_at)}`} className={days >= 7 ? "text-warn" : ""}>
          {days}d here
        </span>
        <span>{e.owner}</span>
      </div>
      {e.placement ? (
        <div className="mt-1.5">
          <Badge tone={e.placement === "joined" ? "ok" : "accent"}>{e.placement.replace(/_/g, " ")}</Badge>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 border-t border-line pt-1.5 text-[12px]">
        {e.stage !== "joined" ? (
          <button type="button" onClick={onNext} className="text-accent hover:underline">
            Next →
          </button>
        ) : null}
        {canShare ? (
          <button type="button" onClick={onShare} className="text-accent hover:underline">
            {e.has_share ? "Share again" : "Share CV"}
          </button>
        ) : null}
        {canPlace ? (
          <button type="button" onClick={onPlace} className="text-accent hover:underline">
            Offer accepted
          </button>
        ) : null}
        {e.stage !== "joined" ? (
          <button type="button" onClick={onExit} className="text-muted hover:text-danger">
            Exit
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ReopenButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await reopenEntry(id)))}>
      {pending ? "…" : "Put back in play"}
    </Button>
  );
}

function ExitDialog({ entry, reasons, onClose }: { entry: Entry | null; reasons: { code: string; label: string }[]; onClose: () => void }) {
  return (
    <Dialog title={entry ? `Take ${entry.name} out of the running` : "Exit"} open={!!entry} onOpenChange={(o) => !o && onClose()}>
      {(close) => (entry ? <ExitForm key={entry.id} entry={entry} reasons={reasons} close={close} /> : null)}
    </Dialog>
  );
}

function ExitForm({ entry, reasons, close }: { entry: Entry; reasons: { code: string; label: string }[]; close: () => void }) {
  const [reason, setReason] = useState("");
  const [state, action] = useActionState(async (s: ActionState, fd: FormData) => {
    const r = await exitEntry(s, fd);
    if (r?.ok) close();
    return r;
  }, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="entry_id" value={entry.id} />
      <FormMessage state={state} />
      <Field label="Reason *">
        <Select name="exit_reason" required value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
          <option value="" disabled>
            Pick a reason
          </option>
          {reasons.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      {reason === "asked_for_time" ? (
        <Field label="Follow up on *" hint="Shows up in Reminders on this date.">
          <Input type="date" name="follow_up_on" required />
        </Field>
      ) : null}
      <Field label="Note">
        <Textarea name="exit_note" rows={2} />
      </Field>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}

function PlaceDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  return (
    <Dialog title={entry ? `Offer accepted: ${entry.name}` : "Offer"} open={!!entry} onOpenChange={(o) => !o && onClose()}>
      {(close) => (entry ? <PlaceForm key={entry.id} entry={entry} close={close} /> : null)}
    </Dialog>
  );
}

function PlaceForm({ entry, close }: { entry: Entry; close: () => void }) {
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  const [state, action] = useActionState(async (s: ActionState, fd: FormData) => {
    const r = await recordPlacement(s, fd);
    if (r?.ok) setTimeout(close, 900);
    return r;
  }, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="entry_id" value={entry.id} />
      <FormMessage state={state} />
      <p className="text-[13px] text-muted">The fee % and replacement window come from the client&apos;s agreement. Billing picks this up.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Offer accepted on">
          <Input type="date" name="offer_accepted_on" defaultValue={today} />
        </Field>
        <Field label="Joining date" hint="Leave blank if not fixed yet.">
          <Input type="date" name="joining_date" />
        </Field>
        <Field label="Annual fixed salary (lakhs) *">
          <Input name="annual_fixed_salary" inputMode="decimal" required placeholder="24" />
        </Field>
        <Field label="Fee %" hint="Blank = from the agreement.">
          <Input name="fee_percent" inputMode="decimal" placeholder="10" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="joined" /> They have already joined
      </label>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
