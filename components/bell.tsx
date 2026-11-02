"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { markAllRead, markRead } from "@/lib/actions/notifications";
import { ago } from "@/lib/format";

export type Note = { id: string; title: string; body: string | null; mandate_id: string | null; candidate_id: string | null; read_at: string | null; created_at: string };

export function BellMenu({ notes, unread }: { notes: Note[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-50 w-80 rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="font-semibold">Re-engagement alerts</span>
            {unread ? (
              <button type="button" onClick={() => start(() => markAllRead())} className="text-[12px] text-accent hover:underline">
                Mark all read
              </button>
            ) : null}
          </div>
          {notes.length ? (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className={n.read_at ? "opacity-60" : ""}>
                  <Link
                    href={n.mandate_id ? `/mandates/${n.mandate_id}` : n.candidate_id ? `/candidates/${n.candidate_id}` : "/reminders"}
                    onClick={() => {
                      setOpen(false);
                      if (!n.read_at) start(() => markRead(n.id));
                    }}
                    className="block px-4 py-2.5 hover:bg-canvas"
                  >
                    <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-[12px] text-muted">{n.body}</p> : null}
                    <p className="mt-0.5 text-[11px] text-faint">{ago(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-muted">Nothing yet. When a mandate opens, past candidates who fit show up here.</p>
          )}
          <Link href="/reminders" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2 text-center text-[12px] text-accent hover:underline">
            All reminders
          </Link>
        </div>
      ) : null}
    </div>
  );
}
