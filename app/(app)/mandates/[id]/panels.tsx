"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/form";
import { createClient } from "@/lib/supabase/client";
import { ago, formatPqe } from "@/lib/format";
import { addCandidates, setMandateStatus } from "../actions";

const statuses = [
  ["active", "Active"],
  ["on_hold", "On hold"],
  ["filled", "Filled"],
  ["lost", "Lost"],
] as const;

export function StatusControl({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-line text-[13px]">
        {statuses.map(([v, l]) => (
          <button
            key={v}
            type="button"
            disabled={pending || v === status}
            onClick={() =>
              start(async () => {
                const r = await setMandateStatus(id, v);
                setErr(r.error ?? null);
              })
            }
            className={`border-l border-line px-3 py-1.5 first:border-l-0 ${v === status ? "bg-accent text-white" : "bg-surface hover:bg-canvas"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {status !== "active" ? <span className="text-[12px] text-muted">Setting it back to Active reopens it and re-runs re-engagement.</span> : null}
      {err ? <span className="text-[12px] text-danger">{err}</span> : null}
    </div>
  );
}

export type Match = {
  candidate_id: string;
  full_name: string;
  score: number;
  reasons: string[];
  pqe_today: number | null;
  last_by: string | null;
  last_called_at: string | null;
};

/** Past candidates who fit: re-engagement, the top-priority feature. */
export function Matches({ mandateId, matches }: { mandateId: string; matches: Match[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!matches.length) return <p className="text-[13px] text-muted">Nobody in the database fits yet. Interest tags from screening calls feed this list.</p>;
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  return (
    <div>
      <ul className="divide-y divide-line">
        {matches.map((m) => (
          <li key={m.candidate_id} className="flex gap-2.5 py-2">
            <input type="checkbox" className="mt-1" checked={picked.includes(m.candidate_id)} onChange={() => toggle(m.candidate_id)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/candidates/${m.candidate_id}`} className="font-medium hover:text-accent">
                  {m.full_name}
                </Link>
                <span className="text-[12px] text-faint">{m.pqe_today != null ? formatPqe(m.pqe_today) : ""}</span>
              </div>
              <p className="text-[12px] text-muted">{m.reasons.join(" · ")}</p>
              <p className="text-[12px] text-faint">{m.last_called_at ? `Last call: ${m.last_by ?? "someone"}, ${ago(m.last_called_at)}` : "Never called"}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={!picked.length || pending}
          onClick={() =>
            start(async () => {
              const r = await addCandidates(mandateId, picked);
              setMsg(r.error ?? `Added ${picked.length} to Mapped.`);
              if (r.ok) setPicked([]);
            })
          }
        >
          {pending ? "Adding…" : `Add ${picked.length || ""} to mandate`}
        </Button>
        {msg ? <span className="text-[12px] text-muted">{msg}</span> : null}
      </div>
    </div>
  );
}

/** Search our database and put someone on this mandate. */
export function AddCandidate({ mandateId }: { mandateId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ candidate_id: string; full_name: string; current_firm: string | null; pqe_today: number | null }[]>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function search(term: string) {
    setQ(term);
    if (term.trim().length < 3) return setHits([]);
    const { data } = await createClient().rpc("lookup", { q: term.trim(), p_limit: 8 });
    setHits(data ?? []);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add candidate</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={q}
              onChange={(e) => search(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              placeholder="Name, phone, email or LinkedIn URL"
              className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent"
            />
            <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto">
              {hits.map((h) => (
                <li key={h.candidate_id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{h.full_name}</span>
                    <span className="block text-[12px] text-muted">{[h.current_firm, h.pqe_today != null ? formatPqe(h.pqe_today) : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await addCandidates(mandateId, [h.candidate_id]);
                        setMsg(r.error ?? `${h.full_name} added to Mapped.`);
                      })
                    }
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
            {q.trim().length >= 3 && !hits.length ? (
              <p className="py-3 text-[13px] text-muted">
                Not in the database.{" "}
                <Link href={`/candidates/new?q=${encodeURIComponent(q)}`} className="text-accent underline">
                  Add them as a new candidate
                </Link>
                , then add them here.
              </p>
            ) : null}
            {msg ? <p className="pt-2 text-[13px] text-ok">{msg}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
