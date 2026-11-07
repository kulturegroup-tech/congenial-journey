"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { ArrowRight, CalendarClock, CircleSlash, Send } from "lucide-react";
import { Button, Dialog, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { celebrate } from "@/components/confetti";
import { useContextMenu, type MenuItem } from "@/components/context-menu";
import { useToast } from "@/components/toast";
import { Avatar, Badge } from "@/components/ui";
import { DATED_STAGES, PHASES, STAGES, stageLabel } from "@/lib/constants";
import { formatDate, formatDateTime, formatPqe } from "@/lib/format";
import type { ActionState } from "@/lib/forms";
import { exitEntry, moveStage, recordPlacement, reopenEntry, setInterviewAt } from "../actions";
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
  interview_at: string | null;
  owner: string;
  has_share: boolean;
  placement: string | null;
};

const order = STAGES.map((s) => s.value as string);
const idx = (s: string) => order.indexOf(s);
const phaseTone = ["bg-mist", "bg-lilac", "bg-accent-soft"];

/** The pipeline as three phases. Drag a card onto a stage, or right-click it. */
export function Board({ entries, exitReasons }: { entries: Entry[]; exitReasons: { code: string; label: string }[] }) {
  const toast = useToast();
  const openMenu = useContextMenu();
  const [optimistic, move] = useOptimistic(entries, (state, m: { id: string; stage: string }) =>
    state.map((e) => (e.id === m.id ? { ...e, stage: m.stage, days_in_stage: 0 } : e)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [share, setShare] = useState<{ id: string; then?: string } | null>(null);
  const [dropping, setDropping] = useState<Entry | null>(null);
  const [placing, setPlacing] = useState<Entry | null>(null);
  const [dating, setDating] = useState<Entry | null>(null);
  const [showDropped, setShowDropped] = useState(false);

  const active = optimistic.filter((e) => !e.exit_reason);
  const dropped = optimistic.filter((e) => e.exit_reason);

  function goTo(e: Entry, stage: string) {
    setError(null);
    if (!stage || stage === e.stage) return;
    if (idx(stage) >= idx("cv_shared") && !e.has_share) {
      setShare({ id: e.id, then: stage });
      return;
    }
    start(async () => {
      move({ id: e.id, stage });
      const r = await moveStage(e.id, stage as never);
      if (r.error) return setError(`${e.name}: ${r.error}`);
      if (stage === "joined") {
        celebrate();
        toast({ message: `${e.name} joined. Raise the invoice from Billing.` });
      } else if (DATED_STAGES.includes(stage)) setDating({ ...e, stage });
      else toast({ message: `${e.name} moved to ${stageLabel(stage)}` });
    });
  }

  function onDrop(target: string) {
    const e = optimistic.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (!e) return;
    if (target === "__drop") setDropping(e);
    else goTo(e, target);
  }

  const zone = (key: string) => ({
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

  const menuFor = (e: Entry): MenuItem[] => {
    const next = order[idx(e.stage) + 1];
    const prev = order[idx(e.stage) - 1];
    const items: MenuItem[] = [];
    if (next) items.push({ label: `Move to ${stageLabel(next)}`, icon: <ArrowRight size={15} />, onSelect: () => goTo(e, next) });
    if (prev) items.push({ label: `Back to ${stageLabel(prev)}`, icon: <ArrowRight size={15} className="rotate-180" />, onSelect: () => goTo(e, prev) });
    if (idx(e.stage) <= idx("cv_shared")) items.push({ label: e.has_share ? "Share CV again" : "Share CV", icon: <Send size={15} />, onSelect: () => setShare({ id: e.id }), divider: true });
    if (DATED_STAGES.includes(e.stage)) items.push({ label: e.interview_at ? "Change the date" : "Add the date", icon: <CalendarClock size={15} />, onSelect: () => setDating(e) });
    if (idx(e.stage) >= idx("offer") && !e.placement && e.stage !== "joined") items.push({ label: "Offer accepted", onSelect: () => setPlacing(e) });
    items.push({ label: "Open profile", href: `/candidates/${e.candidate_id}`, divider: true });
    if (e.stage !== "joined") items.push({ label: "Drop from this mandate", icon: <CircleSlash size={15} />, onSelect: () => setDropping(e) });
    return items;
  };

  return (
    <div>
      {error ? (
        <p className="mb-3 flex items-center justify-between gap-4 rounded-2xl bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
          {error}
          <button type="button" onClick={() => setError(null)} className="font-medium">
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {PHASES.map((ph, pi) => {
          const inPhase = active.filter((e) => (ph.stages as readonly string[]).includes(e.stage));
          return (
            <section key={ph.key} className={`rounded-3xl p-3 ${phaseTone[pi]}`}>
              <header className="flex items-baseline justify-between px-2 pb-2 pt-1">
                <h3 className="text-[15.5px] font-semibold">{ph.label}</h3>
                <span className="text-[13px] tabular-nums text-muted">{inPhase.length || ""}</span>
              </header>
              {!inPhase.length && !dragId ? <p className="rounded-2xl bg-white/50 px-3 py-6 text-center text-[13px] text-muted">No one here yet</p> : null}
              {ph.stages.map((st) => {
                const cards = inPhase.filter((e) => e.stage === st);
                if (!cards.length && !dragId) return null;
                return (
                  <div
                    key={st}
                    {...zone(st)}
                    className={`mb-1.5 rounded-2xl p-1 transition-colors ${over === st ? "bg-white/80 ring-2 ring-accent/40" : dragId ? "bg-white/30" : ""}`}
                  >
                    <p className="flex items-baseline gap-1.5 px-2 pb-1.5 pt-1 text-[12.5px] font-medium text-ink/65">
                      {stageLabel(st)}
                      <span className="tabular-nums text-ink/40">{cards.length || ""}</span>
                    </p>
                    {cards.map((e) => (
                      <Card
                        key={e.id}
                        e={e}
                        dragging={dragId === e.id}
                        onDragStart={() => setDragId(e.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOver(null);
                        }}
                        onMenu={(ev) => openMenu(ev, menuFor(e))}
                        onNext={() => goTo(e, order[idx(e.stage) + 1])}
                        onShare={() => setShare({ id: e.id })}
                        onDrop={() => setDropping(e)}
                      />
                    ))}
                    {!cards.length ? <div className="mx-1 mb-1 rounded-xl border border-dashed border-ink/20 px-3 py-3 text-center text-[12px] text-muted">Drop here</div> : null}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <div
        {...zone("__drop")}
        className={`mt-3 overflow-hidden rounded-2xl border border-dashed text-center text-[13px] transition-all duration-300 ${
          dragId ? "max-h-20 py-4 opacity-100" : "max-h-0 py-0 opacity-0"
        } ${over === "__drop" ? "border-danger bg-danger-soft text-danger" : "border-ink/20 text-muted"}`}
      >
        Drop here to take them off this mandate
      </div>

      <div className="mt-5">
        <button type="button" onClick={() => setShowDropped(!showDropped)} className="state rounded-full px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink">
          {showDropped ? "Hide" : "Show"} dropped ({dropped.length})
        </button>
        {showDropped && dropped.length ? (
          <div className="mt-2 overflow-hidden rounded-3xl ring-1 ring-line">
            {dropped.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 text-[13px] last:border-0">
                <span>
                  <Link href={`/candidates/${e.candidate_id}`} className="font-semibold hover:text-accent">
                    {e.name}
                  </Link>{" "}
                  <span className="text-muted">
                    at {stageLabel(e.stage)}: {e.exit_label ?? e.exit_reason}
                    {e.exit_note ? `, “${e.exit_note}”` : ""}
                    {e.follow_up_on ? `. Follow up ${formatDate(e.follow_up_on)}` : ""}
                  </span>
                </span>
                <PutBackButton id={e.id} name={e.name} />
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
          if (e && then && idx(then) > idx("cv_shared"))
            start(async () => {
              const r = await moveStage(e.id, then as never);
              if (r.error) toast({ message: `${e.name}: ${r.error}` });
            });
        }}
      />
      <DropDialog
        entry={dropping}
        reasons={exitReasons}
        onClose={() => setDropping(null)}
        onDone={(e) =>
          toast({
            message: `${e.name} dropped`,
            action: {
              label: "Undo",
              onClick: () =>
                start(async () => {
                  const r = await reopenEntry(e.id);
                  toast({ message: r.error ?? `${e.name} is back on the board` });
                }),
            },
          })
        }
      />
      <PlaceDialog entry={placing} onClose={() => setPlacing(null)} />
      <DateDialog entry={dating} onClose={() => setDating(null)} />
    </div>
  );
}

function Card({
  e,
  dragging,
  onDragStart,
  onDragEnd,
  onMenu,
  onNext,
  onShare,
  onDrop,
}: {
  e: Entry;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMenu: (ev: React.MouseEvent) => void;
  onNext: () => void;
  onShare: () => void;
  onDrop: () => void;
}) {
  const canShare = idx(e.stage) < idx("cv_shared");
  const icon = "state grid h-7 w-7 place-items-center rounded-full text-ink/70 hover:text-ink";
  return (
    <div
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onContextMenu={onMenu}
      className={`state state-ink group mb-1.5 cursor-grab overflow-hidden rounded-2xl bg-white px-3 py-2.5 transition-[opacity,transform,box-shadow] duration-300 hover:shadow-[0_12px_24px_-18px_rgb(29_42_36/0.6)] active:cursor-grabbing ${dragging ? "scale-[0.98] opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={e.name} size={30} />
        <div className="min-w-0 flex-1">
          <Link href={`/candidates/${e.candidate_id}`} draggable={false} className="block truncate font-semibold leading-tight hover:text-accent">
            {e.name}
          </Link>
          <p className="truncate text-[12px] text-muted">{[e.firm, e.pqe != null ? formatPqe(e.pqe) : null].filter(Boolean).join(" · ") || "No firm recorded"}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-muted">
        <span className="swap justify-items-start">
          <span className="swap-out flex items-center gap-2">
            <span className={e.days_in_stage >= 7 ? "font-medium text-warn" : ""}>{e.days_in_stage ? `${e.days_in_stage}d here` : "New today"}</span>
            {e.interview_at ? <span className="rounded-full bg-lilac px-2 py-0.5 text-lilac-ink">{formatDateTime(e.interview_at)}</span> : null}
            {e.placement ? <Badge tone={e.placement === "joined" ? "ok" : "accent"}>{e.placement.replace(/_/g, " ")}</Badge> : null}
          </span>
          <span className="swap-in flex items-center gap-0.5">
            {e.stage !== "joined" ? (
              <button type="button" className={icon} title={`Move to ${stageLabel(order[idx(e.stage) + 1])}`} onClick={onNext}>
                <ArrowRight size={14} />
              </button>
            ) : null}
            {canShare ? (
              <button type="button" className={icon} title="Share CV" onClick={onShare}>
                <Send size={14} />
              </button>
            ) : null}
            {e.stage !== "joined" ? (
              <button type="button" className={icon} title="Drop from this mandate" onClick={onDrop}>
                <CircleSlash size={14} />
              </button>
            ) : null}
          </span>
        </span>
        <span>{e.owner}</span>
      </div>
    </div>
  );
}

function PutBackButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await reopenEntry(id);
          toast({ message: r.error ?? `${name} is back in play` });
        })
      }
    >
      Put back in play
    </Button>
  );
}

function DropDialog({ entry, reasons, onClose, onDone }: { entry: Entry | null; reasons: { code: string; label: string }[]; onClose: () => void; onDone: (e: Entry) => void }) {
  return (
    <Dialog title={entry ? `Drop ${entry.name}?` : "Drop"} open={!!entry} onOpenChange={(o) => !o && onClose()}>
      {(close) =>
        entry ? (
          <DropForm
            key={entry.id}
            entry={entry}
            reasons={reasons}
            done={() => {
              onDone(entry);
              close();
            }}
          />
        ) : null
      }
    </Dialog>
  );
}

function DropForm({ entry, reasons, done }: { entry: Entry; reasons: { code: string; label: string }[]; done: () => void }) {
  const [reason, setReason] = useState("");
  const [state, action] = useActionState(async (s: ActionState, fd: FormData) => {
    const r = await exitEntry(s, fd);
    if (r?.ok) done();
    return r;
  }, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="entry_id" value={entry.id} />
      <p className="-mt-2 text-muted">They stay in the database and can be put back in play any time.</p>
      <FormMessage state={state} />
      <Field label="Why?">
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
        <Field label="Follow up on" hint="Shows on Today and the calendar that day.">
          <Input type="date" name="follow_up_on" required />
        </Field>
      ) : null}
      <Field label="Note">
        <Textarea name="exit_note" rows={2} placeholder="Anything worth remembering" />
      </Field>
      <SubmitButton>Drop</SubmitButton>
    </form>
  );
}

function DateDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  return (
    <Dialog title={entry ? `When is ${entry.name}'s ${stageLabel(entry.stage).toLowerCase()}?` : "Date"} open={!!entry} onOpenChange={(o) => !o && onClose()}>
      {(close) => (entry ? <DateForm key={entry.id} entry={entry} close={close} /> : null)}
    </Dialog>
  );
}

function DateForm({ entry, close }: { entry: Entry; close: () => void }) {
  const [when, setWhen] = useState(entry.interview_at ? new Date(new Date(entry.interview_at).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : "");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="space-y-4">
      <p className="-mt-2 text-muted">It goes on the calendar. Skip if it isn&apos;t fixed yet.</p>
      <Field label="Date and time (India)">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} autoFocus />
      </Field>
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={pending || !when}
          onClick={() =>
            start(async () => {
              const r = await setInterviewAt(entry.id, when);
              toast({ message: r.error ?? `${stageLabel(entry.stage)} with ${entry.name} is on the calendar` });
              close();
            })
          }
        >
          Save
        </Button>
        <Button variant="ghost" onClick={close}>
          Skip
        </Button>
      </div>
    </div>
  );
}

function PlaceDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  return (
    <Dialog title={entry ? `${entry.name} accepted the offer` : "Offer"} open={!!entry} onOpenChange={(o) => !o && onClose()}>
      {(close) => (entry ? <PlaceForm key={entry.id} entry={entry} close={close} /> : null)}
    </Dialog>
  );
}

function PlaceForm({ entry, close }: { entry: Entry; close: () => void }) {
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  const toast = useToast();
  const [state, action] = useActionState(async (s: ActionState, fd: FormData) => {
    const r = await recordPlacement(s, fd);
    if (r?.ok) {
      if (fd.get("joined") === "on") celebrate();
      toast({ message: r.message ?? "Saved" });
      close();
    }
    return r;
  }, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="entry_id" value={entry.id} />
      <FormMessage state={state} />
      <p className="-mt-2 text-muted">Fee = agreement % × monthly fixed salary × 12. The % and the replacement window come from the client&apos;s agreement.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Offer accepted on">
          <Input type="date" name="offer_accepted_on" defaultValue={today} />
        </Field>
        <Field label="Joining date" hint="Leave blank if not fixed yet.">
          <Input type="date" name="joining_date" />
        </Field>
        <Field label="Monthly fixed salary (₹)" hint="No bonus or ESOPs. 1.75 also works for ₹1,75,000.">
          <Input name="monthly_fixed_salary" inputMode="decimal" required placeholder="1,75,000" />
        </Field>
        <Field label="Fee %" hint="Blank uses the agreement.">
          <Input name="fee_percent" inputMode="decimal" placeholder="10" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="joined" className="accent-[var(--color-accent)]" /> They have already joined
      </label>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
