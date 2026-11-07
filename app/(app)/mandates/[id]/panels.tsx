"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/form";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { ago, formatPqe } from "@/lib/format";
import { addCandidates, setMandateStatus, undoAdds } from "../actions";

const statuses = [
  ["active", "Active"],
  ["on_hold", "On hold"],
  ["filled", "Filled"],
  ["lost", "Lost"],
] as const;

export function StatusControl({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex rounded-full bg-side p-1">
      {statuses.map(([v, l]) => (
        <button
          key={v}
          type="button"
          disabled={pending || v === status}
          onClick={() =>
            start(async () => {
              const r = await setMandateStatus(id, v);
              toast({
                message: r.error ?? (v === "active" && status !== "active" ? "Reopened. Suggestions are being refreshed." : `Marked ${l.toLowerCase()}`),
                action: r.error
                  ? undefined
                  : {
                      label: "Undo",
                      onClick: () =>
                        start(async () => {
                          const u = await setMandateStatus(id, status as never);
                          toast({ message: u.error ?? "Undone" });
                        }),
                    },
              });
            })
          }
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${v === status ? "bg-surface text-ink shadow-[0_4px_12px_-8px_rgb(29_42_36/0.5)]" : "text-muted hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** What to say after Undo on an add. Entries can only be taken back for 15 minutes, before anything happens to them. */
export const undoMessage = (u: { error?: string; removed?: number }) =>
  u.error ?? (u.removed ? "Undone" : "Too late to undo. Drop them from the mandate instead.");

export type Match = {
  candidate_id: string;
  full_name: string;
  score: number;
  reasons: string[];
  pqe_today: number | null;
  last_by: string | null;
  last_called_at: string | null;
};

/** People we've spoken to before who fit this mandate: the top-priority feature. */
export function Matches({ mandateId, matches }: { mandateId: string; matches: Match[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!matches.length)
    return <p className="rounded-2xl bg-white/60 px-4 py-4 text-[13px] text-ink/70">Nobody fits yet. What people tell you on screening calls (firms, cities, roles they want) feeds this list.</p>;
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const add = (ids: string[]) =>
    start(async () => {
      const r = await addCandidates(mandateId, ids);
      if (r.error) return toast({ message: r.error });
      setPicked([]);
      toast({
        message: `${ids.length === 1 ? "1 person" : `${ids.length} people`} added to Yet to speak`,
        action: r.added?.length ? { label: "Undo", onClick: () => start(async () => toast({ message: undoMessage(await undoAdds(r.added!)) })) } : undefined,
      });
    });
  return (
    <div>
      <ul className="space-y-1.5">
        {matches.map((m) => {
          const on = picked.includes(m.candidate_id);
          return (
            <li key={m.candidate_id}>
              <label className={`state state-ink flex cursor-pointer items-start gap-3 overflow-hidden rounded-2xl px-3 py-2.5 transition-colors ${on ? "bg-white" : "bg-white/55"}`}>
                <input type="checkbox" className="mt-2.5 accent-[var(--color-accent)]" checked={on} onChange={() => toggle(m.candidate_id)} />
                <Avatar name={m.full_name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <Link href={`/candidates/${m.candidate_id}`} className="font-semibold hover:text-accent">
                      {m.full_name}
                    </Link>
                    <span className="text-[12px] text-muted">{m.pqe_today != null ? formatPqe(m.pqe_today) : ""}</span>
                  </span>
                  <span className="block text-[12px] text-ink/70">{m.reasons.join(" · ")}</span>
                  <span className="block text-[11.5px] text-muted">{m.last_called_at ? `${m.last_by ?? "Someone"} spoke to them ${ago(m.last_called_at)}` : "Never called"}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" size="sm" disabled={!picked.length || pending} onClick={() => add(picked)}>
          {picked.length ? `Add ${picked.length}` : "Tick people to add"}
        </Button>
        {matches.length > 1 ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => add(matches.map((m) => m.candidate_id))}>
            Add all {matches.length}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type Hit = { candidate_id: string; full_name: string; current_firm: string | null; pqe_today: number | null };

/** Search our database and put someone on this mandate. */
export function AddCandidate({ mandateId }: { mandateId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ q: string; rows: Hit[] } | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const term = q.trim();

  useEffect(() => {
    if (term.length < 3) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("lookup", { q: term, p_limit: 8 });
      if (live) setHits({ q: term, rows: (data as Hit[]) ?? [] });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);
  const rows = term.length >= 3 && hits?.q === term ? hits.rows : [];

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <UserPlus size={16} />
        Add someone
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 px-4 pt-[14vh]" onMouseDown={() => setOpen(false)}>
          <div className="pop w-full max-w-lg overflow-hidden rounded-3xl bg-surface shadow-[0_30px_80px_-24px_rgb(29_42_36/0.55)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search size={18} className="text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                placeholder="Name, phone, email or LinkedIn link"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {rows.map((h) => (
                <li key={h.candidate_id} className="flex items-center gap-3 rounded-2xl px-3 py-2">
                  <Avatar name={h.full_name} size={32} />
                  <span className="flex-1">
                    <b className="font-semibold">{h.full_name}</b>
                    <span className="block text-[12.5px] text-muted">{[h.current_firm, h.pqe_today != null ? formatPqe(h.pqe_today) : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await addCandidates(mandateId, [h.candidate_id]);
                        toast({
                          message: r.error ?? `${h.full_name} added to Yet to speak`,
                          action: r.added?.length ? { label: "Undo", onClick: () => start(async () => toast({ message: undoMessage(await undoAdds(r.added!)) })) } : undefined,
                        });
                      })
                    }
                  >
                    Add
                  </Button>
                </li>
              ))}
              {term.length >= 3 && hits?.q === term && !rows.length ? (
                <li className="px-3 py-3 text-[13px] text-muted">
                  Not in the database yet.{" "}
                  <Link href={`/candidates/new?q=${encodeURIComponent(q)}`} className="font-medium text-accent underline underline-offset-2">
                    Add them as a new candidate
                  </Link>
                  , then add them here.
                </li>
              ) : null}
              {term.length < 3 ? <li className="px-3 py-3 text-[13px] text-muted">Type at least three letters or digits.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
