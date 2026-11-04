"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { markAllRead, markRead } from "@/lib/actions/notifications";
import { Bell } from "lucide-react";
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
        className="state relative grid h-8 w-8 place-items-center rounded-full text-muted hover:text-ink"
      >
        <Bell size={18} strokeWidth={1.8} />
        {unread ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="pop absolute left-0 top-10 z-50 w-[340px] origin-top-left overflow-hidden rounded-3xl bg-surface shadow-[0_0_0_1px_var(--color-line),0_24px_48px_-20px_rgb(29_42_36/0.4)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <span className="font-semibold">Suggestions for you</span>
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
                    className="block px-5 py-3 transition-colors hover:bg-canvas"
                  >
                    <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-[12px] text-muted">{n.body}</p> : null}
                    <p className="mt-0.5 text-[11px] text-faint">{ago(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-muted">Nothing yet. When a mandate opens, people you&apos;ve spoken to who fit it show up here.</p>
          )}
          <Link href="/reminders" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2 text-center text-[12px] text-accent hover:underline">
            All reminders
          </Link>
        </div>
      ) : null}
    </div>
  );
}
