"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPqe } from "@/lib/format";
import { Dialog, inputClass } from "./form";
import { Avatar } from "./ui";

type Hit = { candidate_id: string; full_name: string; current_firm: string | null; pqe_today: number | null };

/** The one main action, always in reach. */
export function LogCallButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ev = () => setOpen(true);
    window.addEventListener("ps:log-call", ev);
    return () => window.removeEventListener("ps:log-call", ev);
  }, []);
  return (
    <>
      <button
        type="button"
        data-ripple
        onClick={() => setOpen(true)}
        className="state no-print fixed bottom-7 right-8 z-40 flex h-14 items-center gap-2.5 overflow-hidden rounded-[20px] bg-accent pl-5 pr-6 text-[14.5px] font-semibold text-white shadow-[0_10px_28px_-12px_rgb(36_69_58/0.7)] transition-[border-radius] duration-500 [transition-timing-function:var(--ease-spring)] active:rounded-2xl"
      >
        <PhoneCall size={18} strokeWidth={1.9} />
        Log a call
      </button>
      <Dialog title="Log a call" open={open} onOpenChange={setOpen}>
        {(close) => <Pick close={close} />}
      </Dialog>
    </>
  );
}

function Pick({ close }: { close: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ q: string; rows: Hit[] } | null>(null);
  const term = q.trim();
  useEffect(() => {
    if (term.length < 3) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("lookup", { q: term, p_limit: 6 });
      if (live) setHits({ q: term, rows: (data as Hit[]) ?? [] });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);
  const rows = term.length >= 3 && hits?.q === term ? hits.rows : [];
  return (
    <div>
      <p className="-mt-2 mb-4 text-muted">Who did you speak to? The 14 questions come next.</p>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, email or LinkedIn link" className={inputClass} />
      <ul className="mt-3 space-y-1">
        {rows.map((h) => (
          <li key={h.candidate_id}>
            <button
              type="button"
              onClick={() => {
                close();
                router.push(`/candidates/${h.candidate_id}/call`);
              }}
              className="state state-ink flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
            >
              <Avatar name={h.full_name} size={32} />
              <span className="flex-1">
                <b className="font-semibold">{h.full_name}</b>
                <span className="block text-[12.5px] text-muted">{[h.current_firm, h.pqe_today != null ? formatPqe(h.pqe_today) : null].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {term.length >= 3 && hits?.q === term && !rows.length ? (
        <p className="mt-3 text-[13px] text-muted">
          Not in the database yet.{" "}
          <Link href={`/candidates/new?q=${encodeURIComponent(term)}`} onClick={close} className="font-medium text-accent underline underline-offset-2">
            Add them first
          </Link>
          , then log the call from their profile.
        </p>
      ) : null}
    </div>
  );
}
