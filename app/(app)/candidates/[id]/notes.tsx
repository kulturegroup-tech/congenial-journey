"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Textarea } from "@/components/form";
import { useToast } from "@/components/toast";
import { formatDate, formatDateTime } from "@/lib/format";
import { saveCandidateNotes } from "../actions";

/** About how many lines fit before the notes fold behind "Show all". */
const FOLD_LINES = 16;
const lineCount = (s: string) => s.split("\n").reduce((n, l) => n + 1 + Math.floor(l.length / 110), 0);

/**
 * One big free-text box per candidate, for pasting call records straight in (the way the team kept
 * them in Odoo's Note tab). Click Edit, or double-click the text. New dated entry puts today's date
 * and your name at the top. If a teammate saved in between, nothing is overwritten: you are told,
 * and your text stays in the box.
 */
export function CandidateNotes({
  candidateId,
  notes,
  updatedAt,
  updatedBy,
  me,
}: {
  candidateId: string;
  notes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  me: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [seen, setSeen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const text = notes ?? "";

  const grow = () => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 4, window.innerHeight * 0.7)}px`;
  };

  const edit = (withStamp = false) => {
    const stamp = `${formatDate(new Date())} · ${me}\n`;
    setDraft(withStamp ? `${stamp}\n${text ? `\n${text}` : ""}` : text);
    setSeen(updatedAt);
    setError(null);
    setEditing(true);
    requestAnimationFrame(() => {
      const el = box.current;
      if (!el) return;
      grow();
      el.focus();
      const at = withStamp ? stamp.length + 1 : 0;
      el.setSelectionRange(at, at);
      el.scrollTop = 0;
    });
  };

  const stampHere = () => {
    const el = box.current;
    if (!el) return;
    const stamp = `${formatDate(new Date())} · ${me}\n`;
    const next = `${stamp}\n${draft ? `\n${draft}` : ""}`;
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(stamp.length + 1, stamp.length + 1);
      el.scrollTop = 0;
      grow();
    });
  };

  const save = () =>
    start(async () => {
      const r = await saveCandidateNotes(candidateId, draft, seen);
      if (r.error) {
        setError(r.error);
        return;
      }
      setEditing(false);
      setOpen(true);
      toast({ message: "Notes saved" });
    });

  const by = updatedAt ? `${updatedBy ?? "Someone"}, ${formatDateTime(updatedAt)}` : null;

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-[16.5px] font-semibold">Notes</h2>
        {!editing ? (
          <span className="flex items-center gap-1">
            {by ? <span className="mr-2 text-[12px] text-muted">Last saved by {by}</span> : null}
            <Button size="sm" variant="ghost" onClick={() => edit(true)}>
              New dated entry
            </Button>
            {text ? (
              <Button size="sm" variant="secondary" onClick={() => edit()}>
                Edit
              </Button>
            ) : null}
          </span>
        ) : null}
      </div>

      {editing ? (
        <div className="space-y-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
          <Textarea
            ref={box}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              grow();
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            rows={12}
            placeholder="Paste the call notes here, or type: what they do now, what they want, CTC, notice, next step…"
            className="min-h-64 text-[13.5px] leading-relaxed"
          />
          {error ? <p className="rounded-2xl bg-danger-soft px-4 py-2.5 text-[13px] text-danger">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save notes"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="ghost" onClick={stampHere} disabled={pending}>
              Add today&apos;s date at the top
            </Button>
            <span className="ml-auto text-[12px] text-faint">Ctrl/⌘ + Enter saves</span>
          </div>
        </div>
      ) : text ? (
        <div className="rounded-3xl bg-surface px-5 py-4 ring-1 ring-line">
          <div
            onDoubleClick={() => edit()}
            title="Double-click to edit"
            className={`whitespace-pre-wrap break-words text-[13.5px] leading-relaxed ${!open && lineCount(text) > FOLD_LINES ? "max-h-[23rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_80%,transparent)]" : ""}`}
          >
            {text}
          </div>
          {lineCount(text) > FOLD_LINES ? (
            <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-[13px] font-medium text-accent hover:underline">
              {open ? "Show less" : "Show all"}
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => edit(true)}
          className="state w-full rounded-3xl border border-dashed border-ink/20 px-5 py-6 text-left text-[13.5px] text-muted hover:text-ink"
        >
          No notes yet. Click to paste call notes or anything worth remembering about them.
        </button>
      )}
    </section>
  );
}
